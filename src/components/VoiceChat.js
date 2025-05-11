import React, { useEffect, useRef, useState } from 'react';
import { FaGraduationCap, FaMicrophone, FaStop } from 'react-icons/fa';
import io from 'socket.io-client';
import CreativeMode from './CreativeMode';
import './VoiceChat.css';

const VoiceChat = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [messages, setMessages] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState('');
  const [audioLevel, setAudioLevel] = useState(0);
  const [isCreativeMode, setIsCreativeMode] = useState(false);
  
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const socketRef = useRef(null);
  const audioStreamRef = useRef(null);
  const analyserRef = useRef(null);
  const animationFrameRef = useRef(null);

  useEffect(() => {
    socketRef.current = io('http://localhost:5000', {
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000
    });

    socketRef.current.on('connect', () => {
      console.log('Connected to server');
      setError('');
    });

    socketRef.current.on('connect_error', (err) => {
      console.error('Connection error:', err);
      setError('Connection error. Please try again.');
    });

    socketRef.current.on('response', (data) => {
      setIsProcessing(false);
      setMessages(prev => [...prev, { 
        type: 'assistant', 
        content: data.text
      }]);

      if (data.audio) {
        const audio = new Audio(URL.createObjectURL(new Blob([data.audio], { type: 'audio/mp3' })));
        audio.onplay = () => setIsPlaying(true);
        audio.onended = () => setIsPlaying(false);
        audio.play().catch(err => {
          console.error('Error playing audio:', err);
          setError('Error playing audio response');
        });
      }
    });

    socketRef.current.on('error', (error) => {
      setIsProcessing(false);
      setError(error);
    });

    return () => {
      if (audioStreamRef.current) {
        audioStreamRef.current.getTracks().forEach(track => track.stop());
      }
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      socketRef.current.disconnect();
    };
  }, []);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          channelCount: 1,
          sampleRate: 16000
        } 
      });
      
      audioStreamRef.current = stream;
      
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      const source = audioContext.createMediaStreamSource(stream);
      source.connect(analyser);
      analyserRef.current = analyser;

      const updateAudioLevel = () => {
        const dataArray = new Uint8Array(analyser.frequencyBinCount);
        analyser.getByteFrequencyData(dataArray);
        const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
        setAudioLevel(average / 128);
        animationFrameRef.current = requestAnimationFrame(updateAudioLevel);
      };
      updateAudioLevel();
      
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : 'audio/webm';
      
      mediaRecorderRef.current = new MediaRecorder(stream, {
        mimeType,
        audioBitsPerSecond: 16000
      });

      audioChunksRef.current = [];

      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorderRef.current.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
        const reader = new FileReader();
        
        reader.onloadend = () => {
          setIsProcessing(true);
          socketRef.current.emit('voiceData', { audio: reader.result });
        };
        
        reader.onerror = () => {
          setError('Error processing audio data');
          setIsProcessing(false);
        };
        
        reader.readAsDataURL(audioBlob);
      };

      mediaRecorderRef.current.start(100);
      setIsRecording(true);
      setError('');
      
      setMessages(prev => [...prev, { 
        type: 'user', 
        content: 'Recording...',
        isRecording: true 
      }]);
    } catch (err) {
      console.error('Error accessing microphone:', err);
      setError('Error accessing microphone: ' + err.message);
      setIsRecording(false);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      audioStreamRef.current.getTracks().forEach(track => track.stop());
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      setAudioLevel(0);
      setIsRecording(false);
      
      setMessages(prev => {
        const newMessages = [...prev];
        const lastMessage = newMessages[newMessages.length - 1];
        if (lastMessage && lastMessage.isRecording) {
          newMessages.pop();
        }
        return newMessages;
      });
    }
  };

  return (
    <div className="voice-chat-container">
      <div className="mode-toggle">
        <button
          className={`mode-button ${!isCreativeMode ? 'active' : ''}`}
          onClick={() => setIsCreativeMode(false)}
        >
          <FaMicrophone /> Voice Chat
        </button>
        <button
          className={`mode-button ${isCreativeMode ? 'active' : ''}`}
          onClick={() => setIsCreativeMode(true)}
        >
          <FaGraduationCap /> Academic Roadmap
        </button>
      </div>

      {isCreativeMode ? (
        <CreativeMode />
      ) : (
        <>
          <div className="messages-container">
            {messages.map((message, index) => (
              <div 
                key={index} 
                className={`message ${message.type}`}
              >
                {message.content}
              </div>
            ))}
          </div>

          {error && <div className="error-message">{error}</div>}

          <div className="controls">
            <button
              onClick={isRecording ? stopRecording : startRecording}
              disabled={isProcessing}
              className={`record-button ${isRecording ? 'recording' : ''}`}
              style={{
                transform: isRecording ? `scale(${1 + audioLevel * 0.1})` : 'scale(1)'
              }}
            >
              {isRecording ? <FaStop /> : <FaMicrophone />}
            </button>
            {isProcessing && (
              <div className="processing-indicator">
                Processing your request...
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default VoiceChat; 