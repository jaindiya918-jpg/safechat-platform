import json
import os
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from django.contrib.auth import get_user_model
from django.utils import timezone
from datetime import timedelta
from chat.models import Stream
from moderation.models import SpeechViolation, StreamTimeout
from moderation.ai_detector import ToxicityDetector
from asgiref.sync import sync_to_async


# Run the moderation call in a threadpool
@sync_to_async
def run_moderation(text: str):
    """Run OpenAI moderation with better error handling and logging"""
    method = os.getenv('MODERATION_METHOD', 'api')
    detector = ToxicityDetector(method=method)
    result = detector.analyze(text)
    
    # Log the result for debugging
    print(f"\n{'='*60}")
    print(f"SPEECH MODERATION RESULT:")
    print(f"Text: {text}")
    print(f"Method: {result.get('method', 'unknown')}")
    print(f"Is Toxic: {result.get('is_toxic', False)}")
    print(f"Toxicity Score: {result.get('toxicity_score', 0):.4f}")
    print(f"Categories: {result.get('categories', {})}")
    print(f"Detected Words: {result.get('detected_words', [])}")
    print(f"{'='*60}\n")
    
    return result


class SpeechModerationConsumer(AsyncWebsocketConsumer):
    """WebSocket consumer for real-time speech moderation"""
    
    async def connect(self):
        self.stream_id = self.scope['url_route']['kwargs']['stream_id']
        self.user_id = self.scope['url_route']['kwargs']['user_id']
        self.room_group_name = f'speech_moderation_{self.stream_id}'
        
        # Join room group
        await self.channel_layer.group_add(
            self.room_group_name,
            self.channel_name
        )
        
        await self.accept()
        print(f"✅ Speech moderation connected: Stream {self.stream_id}, User {self.user_id}")
    
    async def disconnect(self, close_code):
        # Leave room group
        await self.channel_layer.group_discard(
            self.room_group_name,
            self.channel_name
        )
        print(f"❌ Speech moderation disconnected: Stream {self.stream_id}, User {self.user_id}")
    
    async def receive(self, text_data):
        try:
            data = json.loads(text_data)
            message_type = data.get('type')

            if message_type == 'speech_transcript':
                transcript = data.get('transcript', '').strip()
                user_id = data.get('user_id')
                stream_id = data.get('stream_id')

                if not transcript:
                    return

                print(f"\n🎤 Received transcript from user {user_id}: '{transcript}'")

                # Check if user is currently timed out
                is_timed_out = await self.check_timeout(user_id, stream_id)
                if is_timed_out:
                    print(f"⏸️  User {user_id} is timed out, ignoring speech")
                    await self.send(text_data=json.dumps({
                        'type': 'timeout_active',
                        'message': 'You are currently timed out and cannot speak'
                    }))
                    return

                # Run moderation using OpenAI API
                print(f"🔍 Running moderation on: '{transcript}'")
                result = await run_moderation(transcript)

                if result.get('is_toxic'):
                    print(f"🚨 TOXIC SPEECH DETECTED!")
                    print(f"   Score: {result.get('toxicity_score', 0):.4f}")
                    print(f"   Categories: {result.get('categories', {})}")

                    # Compute violation counts first
                    current_count = await self.get_violation_count(user_id, stream_id)
                    new_count = current_count + 1
                    print(f"⚠️  User {user_id} violations: {new_count}/3")

                    # Send toxic response to client (use default=str to avoid serialization errors)
                    toxic_payload = {
                        'type': 'speech_toxic',
                        'transcript': transcript,
                        'details': result,
                        'warning_number': new_count
                    }
                    try:
                        await self.send(text_data=json.dumps(toxic_payload, default=str))
                    except Exception as e:
                        print(f"❗ Failed to send toxic payload: {e}")

                    # Notify client of appropriate action (warning/timeout/stop)
                    if new_count == 1:
                        print(f"⚠️  Issuing WARNING 1/3 to user {user_id}")
                        warning_payload = {
                            'type': 'speech_warning',
                            'warning_number': new_count,
                            'message': f'⚠️ WARNING {new_count}/3: Your speech contains inappropriate content. Continued violations will result in timeout and stream termination.'
                        }
                        try:
                            await self.send(text_data=json.dumps(warning_payload, default=str))
                        except Exception as e:
                            print(f"❗ Failed to send warning payload: {e}")

                    elif new_count == 2:
                        print(f"🔇 Issuing WARNING 2/3 + TIMEOUT to user {user_id}")
                        timeout_seconds = 60
                        try:
                            await self.issue_timeout(user_id, stream_id, timeout_seconds)
                        except Exception as e:
                            print(f"❗ Failed to issue timeout: {e}")
                        timeout_payload = {
                            'type': 'speech_timeout',
                            'warning_number': new_count,
                            'timeout_duration': timeout_seconds,
                            'message': f'🔇 WARNING {new_count}/3: You have been muted for {timeout_seconds} seconds. One more violation will terminate your stream.'
                        }
                        try:
                            await self.send(text_data=json.dumps(timeout_payload, default=str))
                        except Exception as e:
                            print(f"❗ Failed to send timeout payload: {e}")

                    elif new_count >= 3:
                        print(f"🚫 TERMINATING STREAM for user {user_id} (3 violations)")
                        try:
                            await self.stop_stream(stream_id)
                        except Exception as e:
                            print(f"❗ Failed to stop stream: {e}")
                        stop_payload = {
                            'type': 'stream_stopped',
                            'reason': 'Three speech violations detected',
                            'message': '🚫 STREAM TERMINATED: Your stream has been stopped due to repeated speech violations.'
                        }
                        try:
                            await self.send(text_data=json.dumps(stop_payload, default=str))
                        except Exception as e:
                            print(f"❗ Failed to send stream stop payload: {e}")

                    # Best-effort: log the violation to DB, but do not allow DB errors to break the flow
                    try:
                        await self.log_violation(
                            user_id,
                            stream_id,
                            transcript,
                            result.get('toxicity_score', 0),
                            result.get('detected_words', []),
                            new_count
                        )
                    except Exception as e:
                        print(f"❌ Failed to log speech violation for user {user_id}, stream {stream_id}: {e}")
                        import traceback
                        traceback.print_exc()

                else:
                    print(f"✅ Speech is clean")
                    await self.send(text_data=json.dumps({
                        'type': 'speech_clean',
                        'transcript': transcript
                    }))

        except Exception as e:
            print(f"❌ ERROR in speech moderation: {str(e)}")
            import traceback
            traceback.print_exc()
            try:
                await self.send(text_data=json.dumps({
                    'type': 'error',
                    'message': 'Error processing speech'
                }))
            except Exception:
                pass
    
    @database_sync_to_async
    def get_violation_count(self, user_id, stream_id):
        """Get the number of violations for user in this stream"""
        count = SpeechViolation.objects.filter(
            user_id=user_id,
            stream_id=stream_id
        ).count()
        print(f"📊 Current violation count for user {user_id}: {count}")
        return count
    
    @database_sync_to_async
    def log_violation(self, user_id, stream_id, transcript, toxicity_score, detected_words, violation_count):
        """Log a speech violation"""
        violation_type = 'warning'
        if violation_count == 2:
            violation_type = 'timeout'
        elif violation_count >= 3:
            violation_type = 'stream_stop'
        
        violation = SpeechViolation.objects.create(
            user_id=user_id,
            stream_id=stream_id,
            transcript=transcript,
            toxicity_score=toxicity_score,
            detected_words=detected_words,
            violation_type=violation_type
        )
        print(f"💾 Logged violation #{violation_count} (ID: {violation.id})")
        return violation
    
    @database_sync_to_async
    def issue_timeout(self, user_id, stream_id, duration_seconds):
        """Issue a timeout for the user"""
        expires_at = timezone.now() + timedelta(seconds=duration_seconds)
        
        timeout = StreamTimeout.objects.create(
            user_id=user_id,
            stream_id=stream_id,
            duration_seconds=duration_seconds,
            reason="Automatic: Speech violation timeout",
            expires_at=expires_at,
            is_active=True
        )
        print(f"⏰ Timeout issued: {duration_seconds}s (expires at {expires_at})")
        return timeout
    
    @database_sync_to_async
    def check_timeout(self, user_id, stream_id):
        """Check if user is currently timed out"""
        active_timeout = StreamTimeout.objects.filter(
            user_id=user_id,
            stream_id=stream_id,
            is_active=True,
            expires_at__gt=timezone.now()
        ).exists()
        
        if active_timeout:
            print(f"⏸️  User {user_id} is currently timed out")
        
        return active_timeout
    
    @database_sync_to_async
    def stop_stream(self, stream_id):
        """Stop the stream"""
        try:
            stream = Stream.objects.get(id=stream_id)
            stream.status = 'ended'
            stream.ended_at = timezone.now()
            stream.save()
            print(f"🛑 Stream {stream_id} has been stopped")
        except Stream.DoesNotExist:
            print(f"❌ Stream {stream_id} not found")
            pass