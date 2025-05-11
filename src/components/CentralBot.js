import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import io from "socket.io-client";
import "./CentralBot.css";

const CentralBot = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [messages, setMessages] = useState([]);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const socketRef = useRef(null);
  const audioStreamRef = useRef(null);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const animationFrameRef = useRef(null);
  const canvasRef = useRef(null);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    socketRef.current = io("http://localhost:5000", {
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    socketRef.current.on("connect", () => {
      console.log("Connected to server");
      setError("");
    });

    socketRef.current.on("connect_error", (err) => {
      console.error("Connection error:", err);
      setError("Connection error. Please try again.");
    });

    socketRef.current.on("response", (data) => {
      setIsProcessing(false);
      if (data.text) {
        setMessages((prev) => [...prev, { type: "bot", text: data.text }]);
      }

      processCommand(data.text);

      if (data.audio) {
        const audio = new Audio(
          URL.createObjectURL(new Blob([data.audio], { type: "audio/mp3" }))
        );
        audio.play().catch((err) => {
          console.error("Error playing audio:", err);
        });
      }
    });

    socketRef.current.on("error", (error) => {
      setIsProcessing(false);
      setError(error);
    });

    return () => {
      if (audioStreamRef.current) {
        audioStreamRef.current.getTracks().forEach((track) => track.stop());
      }
      socketRef.current.disconnect();
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, [navigate]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const analyzeSentiment = async (text) => {
    try {
      const response = await fetch(
        "http://localhost:5000/api/analyze-sentiment",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ text }),
        }
      );
      const data = await response.json();
      return data.sentiment;
    } catch (error) {
      console.error("Error analyzing sentiment:", error);
      return "neutral";
    }
  };

  const getSentimentResponse = (sentiment) => {
    switch (sentiment) {
      case "positive":
        return "I'm glad to hear that! How can I assist you further?";
      case "negative":
        return "I'm sorry to hear that. Let me know how I can help.";
      default:
        return "How can котороеI assist you today?";
    }
  };

  const processCommand = async (text) => {
    try {
      setIsProcessing(true);

      // This is where we send the transcribed text to the LLM
      // We'll use the same approach as your existing code
      const gptCacheKey = text.trim().toLowerCase();

      // Check if we have a cached response
      if (socketRef.current) {
        // Use the existing socket connection to send the transcribed text
        // This will maintain your existing LLM functionality with system prompts
        socketRef.current.emit("processText", { text: text });

        // The response will be handled by your existing socket listeners
      } else {
        // Fallback to direct API call if socket isn't available
        const response = await fetch("http://localhost:5000/api/chat", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ message: text }),
        });

        if (!response.ok) {
          throw new Error(`Server responded with ${response.status}`);
        }

        const data = await response.json();
        setMessages((prev) => [...prev, { type: "bot", text: data.response }]);

        // If TTS is enabled, request audio
        if (data.response) {
          try {
            const ttsResponse = await fetch("http://localhost:5000/api/tts", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({ text: data.response }),
            });

            if (ttsResponse.ok) {
              const ttsData = await ttsResponse.json();
              if (ttsData.audio) {
                const audio = new Audio(
                  `data:audio/mp3;base64,${ttsData.audio}`
                );
                audio.play();
              }
            }
          } catch (ttsError) {
            console.error("Error generating speech:", ttsError);
          }
        }
      }
    } catch (error) {
      console.error("Error processing command:", error);
      setError("Error processing your request: " + error.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const setupAudioAnalyzer = (stream) => {
    audioContextRef.current = new (window.AudioContext ||
      window.webkitAudioContext)();
    analyserRef.current = audioContextRef.current.createAnalyser();
    analyserRef.current.fftSize = 256;
    const source = audioContextRef.current.createMediaStreamSource(stream);
    source.connect(analyserRef.current);
  };

  const drawWaveform = () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const width = canvas.width;
    const height = canvas.height;
    const barCount = 8;
    const barWidth = width / (barCount * 2);
    const barGap = barWidth / 2;

    ctx.clearRect(0, 0, width, height);

    let barHeights = [];

    if ((isRecording || isTranscribing) && analyserRef.current) {
      const bufferLength = analyserRef.current.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      analyserRef.current.getByteFrequencyData(dataArray);

      const step = Math.floor(bufferLength / barCount);
      for (let i = 0; i < barCount; i++) {
        let sum = 0;
        for (let j = 0; j < step; j++) {
          sum += dataArray[i * step + j];
        }
        const average = sum / step;
        const barHeight = (average / 255) * height * 0.8;
        barHeights.push(barHeight);
      }
    } else {
      const time = Date.now() * 0.002;
      barHeights = Array.from({ length: barCount }, (_, i) => {
        const offset = i * 0.5;
        return (Math.sin(time + offset) * 0.3 + 0.5) * height * 0.3;
      });
    }

    barHeights.forEach((barHeight, i) => {
      const x = i * (barWidth + barGap) + barGap;
      const y = (height - barHeight) / 2;
      const barHeightAdjusted = barHeight;

      ctx.fillStyle = "#000000"; // Set the waveform bars to black
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + barWidth, y);
      ctx.lineTo(x + barWidth, y + barHeightAdjusted);
      ctx.lineTo(x, y + barHeightAdjusted);
      ctx.closePath();
      ctx.fill();
    });

    animationFrameRef.current = requestAnimationFrame(drawWaveform);
  };

  const startRecording = async (isForTranscription = false) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          channelCount: 1,
          sampleRate: 16000,
        },
      });

      audioStreamRef.current = stream;

      setupAudioAnalyzer(stream);

      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : "audio/webm";

      mediaRecorderRef.current = new MediaRecorder(stream, {
        mimeType,
        audioBitsPerSecond: 16000,
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

        reader.onerror = () => {
          setError("Error processing audio data");
          setIsProcessing(false);
          setIsTranscribing(false);
        };

        if (isForTranscription) {
          reader.onloadend = async () => {
            try {
              setIsProcessing(true);
              const response = await fetch(
                "http://localhost:5000/api/transcribe",
                {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                  },
                  body: JSON.stringify({ audio: reader.result }),
                }
              );
              const data = await response.json();
              if (data.text) {
                setMessages((prev) => [
                  ...prev,
                  { type: "user", text: data.text },
                  { type: "status", text: "Transcription complete" },
                ]);
                processCommand(data.text);
              } else {
                setError("Transcription failed");
              }
            } catch (err) {
              setError("Error during transcription: " + err.message);
            } finally {
              setIsProcessing(false);
              setIsTranscribing(false);
            }
          };
          reader.readAsDataURL(audioBlob);
        } else {
          reader.onloadend = () => {
            setIsProcessing(true);
            socketRef.current.emit("voiceData", { audio: reader.result });
          };
          reader.readAsDataURL(audioBlob);
        }
      };

      mediaRecorderRef.current.start(100);
      if (isForTranscription) {
        setIsTranscribing(true);
        setMessages((prev) => [
          ...prev,
          { type: "status", text: "Transcribing..." },
        ]);
      } else {
        setIsRecording(true);
        setMessages((prev) => [
          ...prev,
          { type: "status", text: "Listening..." },
        ]);
      }
      setError("");
    } catch (err) {
      console.error("Error accessing microphone:", err);
      setError("Error accessing microphone: " + err.message);
      setIsRecording(false);
      setIsTranscribing(false);
    }
  };

  const stopRecording = (isForTranscription = false) => {
    if (mediaRecorderRef.current && (isRecording || isTranscribing)) {
      mediaRecorderRef.current.stop();
      audioStreamRef.current.getTracks().forEach((track) => track.stop());
      setIsRecording(false);
      setIsTranscribing(false);
      setMessages((prev) => [
        ...prev,
        { type: "status", text: "Processing..." },
      ]);
    }
  };

  const startTranscription = () => {
    startRecording(true);
  };

  const stopTranscription = () => {
    stopRecording(true);
  };

  useEffect(() => {
    drawWaveform();
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isRecording, isTranscribing]);

  return (
    <div>
      <div className="button-container">
        <div className={`bot-control-circle ${isRecording ? "recording" : ""}`}>
          {/* <button
            className={`transcribe-button ${
              isTranscribing ? "transcribing" : ""
            }`}
            onClick={isTranscribing ? stopTranscription : startTranscription}
            disabled={isProcessing || isRecording}
            aria-label={
              isTranscribing ? "Stop transcribing" : "Start transcribing"
            }
          >
            {isTranscribing ? "Stop Transcription" : "Speak & Transcribe"}
          </button> */}
          <canvas
            ref={canvasRef}
            className="waveform-canvas"
            width="200"
            height="200"
          />
        </div>
      </div>
      <div className="messages-container">
        {messages.map((msg, index) => (
          <div key={index} className={`message ${msg.type}`}>
            {msg.text}
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>
      {error && <div className="error">{error}</div>}
    </div>
  );
};

export default CentralBot;
