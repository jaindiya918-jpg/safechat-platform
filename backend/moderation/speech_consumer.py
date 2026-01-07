import json
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from django.contrib.auth.models import User
from django.utils import timezone
from datetime import timedelta
from chat.models import Stream
from moderation.models import SpeechViolation, StreamTimeout
from moderation.ai_detector import ToxicityDetector


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
    
    async def disconnect(self, close_code):
        # Leave room group
        await self.channel_layer.group_discard(
            self.room_group_name,
            self.channel_name
        )
    
    async def receive(self, text_data):
        try:
            data = json.loads(text_data)
            message_type = data.get('type')

            if message_type == 'speech_transcript':
                transcript = data.get('transcript', '')
                user_id = data.get('user_id')
                stream_id = data.get('stream_id')
                
                if not transcript.strip():
                    return
                
                # Check if user is currently timed out
                is_timed_out = await self.check_timeout(user_id, stream_id)
                if is_timed_out:
                    await self.send(text_data=json.dumps({
                        'type': 'timeout_active',
                        'message': 'You are currently timed out from speaking'
                    }))
                    return
                
                # Analyze speech for toxicity
                detector = ToxicityDetector()
                toxicity_result = await database_sync_to_async(detector.analyze)(transcript)
                
                if toxicity_result['is_toxic']:
                    # Get violation count for this stream
                    violation_count = await self.get_violation_count(user_id, stream_id)
                    
                    # Log the violation
                    await self.log_violation(
                        user_id,
                        stream_id,
                        transcript,
                        toxicity_result['toxicity_score'],
                        toxicity_result.get('detected_words', []),
                        violation_count
                    )
                    
                    # Take action based on violation count
                    if violation_count == 0:
                        # First warning
                        await self.send(text_data=json.dumps({
                            'type': 'speech_warning',
                            'warning_number': 1,
                            'message': 'Warning 1/3: Please avoid inappropriate language',
                            'detected_words': toxicity_result.get('detected_words', [])
                        }))
                    elif violation_count == 1:
                        # Second warning
                        await self.send(text_data=json.dumps({
                            'type': 'speech_warning',
                            'warning_number': 2,
                            'message': 'Warning 2/3: This is your second warning for inappropriate speech',
                            'detected_words': toxicity_result.get('detected_words', [])
                        }))
                    elif violation_count == 2:
                        # Third warning + timeout
                        await self.issue_timeout(user_id, stream_id, 60)
                        await self.send(text_data=json.dumps({
                            'type': 'speech_timeout',
                            'warning_number': 3,
                            'message': 'Warning 3/3: You have been timed out for 1 minute',
                            'timeout_duration': 60
                        }))
                        
                        # Notify stream group
                        await self.channel_layer.group_send(
                            self.room_group_name,
                            {
                                'type': 'user_timeout_notification',
                                'user_id': user_id,
                                'duration': 60
                            }
                        )
                    else:
                        # More than 3 violations - stop stream
                        await self.stop_stream(stream_id)
                        await self.send(text_data=json.dumps({
                            'type': 'stream_stopped',
                            'message': 'Your stream has been stopped due to repeated violations',
                            'reason': 'Multiple speech violations'
                        }))
                        
                        # Notify all viewers
                        await self.channel_layer.group_send(
                            self.room_group_name,
                            {
                                'type': 'stream_stopped_notification',
                                'reason': 'Stream stopped due to content policy violations'
                            }
                        )
                else:
                    # Speech is clean
                    await self.send(text_data=json.dumps({
                        'type': 'speech_clean',
                        'transcript': transcript
                    }))
                    
        except Exception as e:
            print(f"Error in speech moderation: {e}")
            await self.send(text_data=json.dumps({
                'type': 'error',
                'message': 'Error processing speech'
            }))
    
    async def user_timeout_notification(self, event):
        """Notify about user timeout"""
        await self.send(text_data=json.dumps({
            'type': 'user_timed_out',
            'user_id': event['user_id'],
            'duration': event['duration']
        }))
    
    async def stream_stopped_notification(self, event):
        """Notify about stream being stopped"""
        await self.send(text_data=json.dumps({
            'type': 'stream_stopped',
            'reason': event['reason']
        }))
    
    @database_sync_to_async
    def get_violation_count(self, user_id, stream_id):
        """Get the number of violations for user in this stream"""
        return SpeechViolation.objects.filter(
            user_id=user_id,
            stream_id=stream_id
        ).count()
    
    @database_sync_to_async
    def log_violation(self, user_id, stream_id, transcript, toxicity_score, detected_words, violation_count):
        """Log a speech violation"""
        violation_type = 'warning'
        if violation_count == 2:
            violation_type = 'timeout'
        elif violation_count >= 3:
            violation_type = 'stream_stop'
        
        SpeechViolation.objects.create(
            user_id=user_id,
            stream_id=stream_id,
            transcript=transcript,
            toxicity_score=toxicity_score,
            detected_words=detected_words,
            violation_type=violation_type
        )
    
    @database_sync_to_async
    def issue_timeout(self, user_id, stream_id, duration_seconds):
        """Issue a timeout for the user"""
        expires_at = timezone.now() + timedelta(seconds=duration_seconds)
        
        StreamTimeout.objects.create(
            user_id=user_id,
            stream_id=stream_id,
            duration_seconds=duration_seconds,
            reason="Automatic: Speech violation timeout",
            expires_at=expires_at,
            is_active=True
        )
    
    @database_sync_to_async
    def check_timeout(self, user_id, stream_id):
        """Check if user is currently timed out"""
        active_timeout = StreamTimeout.objects.filter(
            user_id=user_id,
            stream_id=stream_id,
            is_active=True,
            expires_at__gt=timezone.now()
        ).exists()
        
        return active_timeout
    
    @database_sync_to_async
    def stop_stream(self, stream_id):
        """Stop the stream"""
        try:
            stream = Stream.objects.get(id=stream_id)
            stream.status = 'ended'
            stream.ended_at = timezone.now()
            stream.save()
        except Stream.DoesNotExist:
            pass