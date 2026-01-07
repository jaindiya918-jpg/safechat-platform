// Save this as: frontend/src/hooks/useSpeechRecognition.js
// Custom hook for speech recognition
import { useState, useEffect, useRef } from 'react';

export const useSpeechRecognition = (streamId, userId, isStreaming) => {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [warnings, setWarnings] = useState(0);
  const [isTimedOut, setIsTimedOut] = useState(false);
  const [timeoutRemaining, setTimeoutRemaining] = useState(0);
  const [streamStopped, setStreamStopped] = useState(false);
  
  const recognitionRef = useRef(null);
  const speechWsRef = useRef(null);
  const timeoutIntervalRef = useRef(null);
  const localWarningsRef = useRef(0);

  useEffect(() => {
    if (!isStreaming || !streamId || !userId) return;

    // Initialize Web Speech API
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    
    if (!SpeechRecognition) {
      console.error('Speech recognition not supported in this browser');
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    // Connect to speech moderation WebSocket
    const connectSpeechWebSocket = () => {
      const ws = new WebSocket(`ws://localhost:8000/ws/speech/${streamId}/${userId}/`);
      
      ws.onopen = () => {
        console.log('Speech moderation WebSocket connected');
      };
      
      ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        console.log('Speech moderation message:', data);

        if (data.type === 'speech_warning') {
          setWarnings(data.warning_number);
          alert(data.message);
          // keep local counter in sync if backend reports warnings
          localWarningsRef.current = data.warning_number || localWarningsRef.current;
        } else if (data.type === 'speech_timeout') {
          setWarnings(data.warning_number);
          setIsTimedOut(true);
          setTimeoutRemaining(data.timeout_duration);
          alert(data.message);
          
          // Start countdown
          startTimeoutCountdown(data.timeout_duration);
          
          // Mute audio temporarily
          if (recognitionRef.current) {
            recognitionRef.current.stop();
            setIsListening(false);
          }
        } else if (data.type === 'stream_stopped') {
          setStreamStopped(true);
          alert(data.message);
          if (recognitionRef.current) {
            recognitionRef.current.stop();
          }
        } else if (data.type === 'timeout_active') {
          // User tried to speak while timed out
          console.log('User is timed out');
        } else if (data.type === 'speech_clean') {
          setTranscript(data.transcript);
          // Client-side fallback: detect profanity/abusive phrases if backend labels as clean
          try {
            const text = String(data.transcript || '');
            const badRegex = /\b(fuck|shit|bitch|asshole|you are dumb|stupid|idiot)\b/i;
            if (badRegex.test(text)) {
              localWarningsRef.current = (localWarningsRef.current || 0) + 1;
              setWarnings(localWarningsRef.current);
              alert(`Speech violation detected (${localWarningsRef.current}/3)`);

              // Notify backend if desired (best-effort)
              if (speechWsRef.current && speechWsRef.current.readyState === WebSocket.OPEN) {
                try {
                  speechWsRef.current.send(JSON.stringify({
                    type: 'client_detected_violation',
                    transcript: text,
                    warning_number: localWarningsRef.current,
                    user_id: userId,
                    stream_id: streamId,
                    timestamp: new Date().toISOString()
                  }));
                } catch (e) {
                  console.warn('Failed to notify backend of client-side violation', e);
                }
              }

              if (localWarningsRef.current >= 3) {
                setStreamStopped(true);
                alert('🚨 STREAM TERMINATED (client): repeated violations');
              }
            }
          } catch (e) {
            console.warn('Error in client-side profanity check', e);
          }
        }
      };
      
      ws.onerror = (error) => {
        console.error('Speech WebSocket error:', error);
      };
      
      ws.onclose = () => {
        console.log('Speech WebSocket disconnected');
      };
      
      speechWsRef.current = ws;
    };

    const startTimeoutCountdown = (duration) => {
      let remaining = duration;
      
      if (timeoutIntervalRef.current) {
        clearInterval(timeoutIntervalRef.current);
      }
      
      timeoutIntervalRef.current = setInterval(() => {
        remaining -= 1;
        setTimeoutRemaining(remaining);
        
        if (remaining <= 0) {
          clearInterval(timeoutIntervalRef.current);
          setIsTimedOut(false);
          setTimeoutRemaining(0);
          
          // Resume speech recognition
          if (recognitionRef.current && isStreaming) {
            recognitionRef.current.start();
            setIsListening(true);
          }
        }
      }, 1000);
    };

    recognition.onresult = (event) => {
      let finalTranscript = '';
      
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        
        if (event.results[i].isFinal) {
          finalTranscript += transcript + ' ';
        }
      }
      
      if (finalTranscript.trim() && speechWsRef.current && 
          speechWsRef.current.readyState === WebSocket.OPEN && !isTimedOut) {
        // Send transcript to backend for moderation
        speechWsRef.current.send(JSON.stringify({
          type: 'speech_transcript',
          transcript: finalTranscript.trim(),
          user_id: userId,
          stream_id: streamId,
          timestamp: new Date().toISOString()
        }));
      }
    };

    recognition.onerror = (event) => {
      console.error('Speech recognition error:', event.error);
      if (event.error === 'no-speech') {
        // Restart recognition
        recognition.start();
      }
    };

    recognition.onend = () => {
      // Auto-restart if still streaming and not timed out
      if (isStreaming && !isTimedOut && !streamStopped) {
        try {
          recognition.start();
        } catch (e) {
          console.warn('Could not restart recognition:', e);
        }
      } else {
        setIsListening(false);
      }
    };

    recognitionRef.current = recognition;
    connectSpeechWebSocket();

    // Start recognition
    try {
      recognition.start();
      setIsListening(true);
    } catch (e) {
      console.warn('Could not start recognition:', e);
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      if (speechWsRef.current) {
        speechWsRef.current.close();
      }
      if (timeoutIntervalRef.current) {
        clearInterval(timeoutIntervalRef.current);
      }
    };
  }, [streamId, userId, isStreaming]);

  return {
    isListening,
    transcript,
    warnings,
    isTimedOut,
    timeoutRemaining,
    streamStopped
  };
};