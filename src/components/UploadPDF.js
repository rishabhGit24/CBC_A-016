import { AnimatePresence, motion } from "framer-motion";
import React, { useEffect, useRef, useState } from "react";
import { FaCheckCircle, FaFilePdf, FaSpinner } from "react-icons/fa";
import io from "socket.io-client";
import PDFProcessor from "./PDFProcessor";
import "./UploadPDF.css";

const UploadPDF = () => {
  const [recognizedText, setRecognizedText] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [ttsLoading, setTtsLoading] = useState(false);
  const [error, setError] = useState("");
  const [uploadedPDFs, setUploadedPDFs] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [llmResponse, setLlmResponse] = useState("");
  const [audioUrl, setAudioUrl] = useState(null);

  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const socketRef = useRef(null);
  const audioStreamRef = useRef(null);
  const audioRef = useRef(new Audio());
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const animationFrameRef = useRef(null);
  const canvasRef = useRef(null);

  // Initialize socket and audio cleanup
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
      setRecognizedText(data.text || "");
      setIsRecording(false);
      setIsProcessing(false);
      setError("");

      if (data.text) {
        setLlmResponse(data.text);

        if (data.audio) {
          const blob = new Blob([data.audio], { type: "audio/mp3" });
          const url = URL.createObjectURL(blob);
          setAudioUrl(url);

          audioRef.current.src = url;
          audioRef.current.onplay = () => setIsSpeaking(true);
          audioRef.current.onended = () => setIsSpeaking(false);
          audioRef.current.play().catch((err) => {
            console.error("Error auto-playing audio:", err);
          });
        } else {
          handleTTS(data.text);
        }
      }
    });

    socketRef.current.on("error", (err) => {
      setError(err);
      setIsRecording(false);
      setIsProcessing(false);
    });

    return () => {
      if (audioStreamRef.current) {
        audioStreamRef.current.getTracks().forEach((track) => track.stop());
      }
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
      }
      socketRef.current.disconnect();
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, []);

  // Setup audio analyzer for waveform visualization
  const setupAudioAnalyzer = (stream) => {
    audioContextRef.current = new (window.AudioContext ||
      window.webkitAudioContext)();
    analyserRef.current = audioContextRef.current.createAnalyser();
    analyserRef.current.fftSize = 256;
    const source = audioContextRef.current.createMediaStreamSource(stream);
    source.connect(analyserRef.current);
  };

  // Draw waveform on canvas
  const drawWaveform = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
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

      ctx.fillStyle = "#000000";
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

  // Start waveform animation
  useEffect(() => {
    drawWaveform();
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isRecording, isTranscribing]);

  const handlePDFProcessed = (text) => {
    const newPDF = {
      id: Date.now(),
      name: `PDF_${new Date().toLocaleDateString().replace(/\//g, "-")}.pdf`,
      timestamp: new Date(),
      content: text.substring(0, 100) + "...",
    };
    setUploadedPDFs((prev) => [...prev, newPDF]);
    setIsLoading(false);
    setLlmResponse("");
    setAudioUrl(null);
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
        setIsProcessing(true);
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

              if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
              }

              const data = await response.json();
              if (data.text) {
                setRecognizedText(data.text);
                // Send the transcribed text to the LLM via WebSocket
                socketRef.current.emit("processText", { text: data.text });
              } else {
                setError(data.error || "Transcription failed");
                setIsProcessing(false);
                setIsTranscribing(false);
              }
            } catch (err) {
              setError(`Transcription error: ${err.message}`);
              setIsProcessing(false);
              setIsTranscribing(false);
            }
          };
        } else {
          reader.onloadend = () => {
            socketRef.current.emit("voiceData", { audio: reader.result });
          };
        }
        reader.readAsDataURL(audioBlob);
      };

      mediaRecorderRef.current.start(100);
      if (isForTranscription) {
        setIsTranscribing(true);
      } else {
        setIsRecording(true);
      }
      setError("");
    } catch (err) {
      console.error("Error accessing microphone:", err);
      setError("Microphone error: " + err.message);
      setIsTranscribing(false);
    }
  };

  const stopRecording = (isForTranscription = false) => {
    if (mediaRecorderRef.current && (isRecording || isTranscribing)) {
      mediaRecorderRef.current.stop();
      audioStreamRef.current.getTracks().forEach((track) => track.stop());
      setIsRecording(false);
      setIsTranscribing(false);
    }
  };

  const handleTTS = async (text) => {
    if (!text) return;

    try {
      setTtsLoading(true);
      const response = await fetch("http://localhost:5000/api/tts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ text }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      if (data.audio) {
        const audioBlob = new Blob(
          [Uint8Array.from(atob(data.audio), (c) => c.charCodeAt(0))],
          { type: "audio/mp3" }
        );
        const url = URL.createObjectURL(audioBlob);
        setAudioUrl(url);

        audioRef.current.src = url;
        audioRef.current.onplay = () => setIsSpeaking(true);
        audioRef.current.onended = () => setIsSpeaking(false);
        audioRef.current.play().catch((err) => {
          console.error("Error playing audio:", err);
          setError("Failed to play audio response");
        });
      }
    } catch (error) {
      console.error("Error with text-to-speech:", error);
      setError("Failed to generate speech: " + error.message);
    } finally {
      setTtsLoading(false);
    }
  };

  const playAudioResponse = () => {
    if (audioUrl) {
      audioRef.current.play().catch((err) => {
        console.error("Error playing audio:", err);
        setError("Failed to play audio response");
      });
    } else if (llmResponse) {
      handleTTS(llmResponse);
    }
  };

  const startTranscription = () => {
    startRecording(true);
  };

  const stopTranscription = () => {
    stopRecording(true);
  };

  return (
    <div className="pdf-upload-container" style={{ marginTop: "5em" }}>
      <h2>Upload PDF</h2>

      <div className="upload-section">
        <PDFProcessor
          onPDFProcessed={handlePDFProcessed}
          onUploadStart={() => setIsLoading(true)}
        />
      </div>

      <AnimatePresence>
        {uploadedPDFs.length > 0 && (
          <motion.div
            className="pdf-notification"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
          >
            <div className="pdf-success">
              <FaCheckCircle className="success-icon" />
              <div className="pdf-details">
                <h4>PDF Uploaded Successfully!</h4>
                <p>Latest: {uploadedPDFs[uploadedPDFs.length - 1].name}</p>
              </div>
            </div>

            <div className="pdf-list">
              <h4>Uploaded PDFs ({uploadedPDFs.length})</h4>
              <ul>
                {uploadedPDFs.map((pdf) => (
                  <li key={pdf.id}>
                    <FaFilePdf /> {pdf.name}
                    <span className="pdf-time">
                      {pdf.timestamp.toLocaleTimeString()}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div
        className="voice-section"
        style={{ paddingLeft: "18em", marginBottom: "5em" }}
      >
        <h3>Ask Questions About Your PDF</h3>
        <div className="button-container">
          <div
            className={`bot-control-circle ${isRecording ? "recording" : ""}`}
          >
            <button
              onClick={
                isRecording ? stopRecording : () => startRecording(false)
              }
              disabled={
                uploadedPDFs.length === 0 || isProcessing || isTranscribing
              }
              aria-label={isRecording ? "Stop recording" : "Start recording"}
            >
              <canvas
                ref={canvasRef}
                className="waveform-canvas"
                width="200"
                height="200"
              />
            </button>
          </div>
          <button
            className={`transcribe-button ${
              isTranscribing ? "transcribing" : ""
            }`}
            onClick={isTranscribing ? stopTranscription : startTranscription}
            disabled={uploadedPDFs.length === 0 || isProcessing || isRecording}
            aria-label={
              isTranscribing ? "Stop transcribing" : "Start transcribing"
            }
          >
            {isTranscribing ? "Stop Listening" : "Listen & Transcribe"}
          </button>
        </div>

        {uploadedPDFs.length === 0 && (
          <p className="upload-first">Please upload a PDF first</p>
        )}

        {isProcessing && (
          <div className="processing-indicator">
            <FaSpinner className="spinner" />
            <p>Processing your question...</p>
          </div>
        )}

        {recognizedText && (
          <div className="query-container">
            <h4>Your Question:</h4>
            <p>{recognizedText}</p>
          </div>
        )}

        {llmResponse && (
          <div className="response-container">
            <div className="response-header">
              <h4>Answer:</h4>
              <button
                className={`tts-button ${isSpeaking ? "speaking" : ""}`}
                onClick={playAudioResponse}
                disabled={ttsLoading}
              >
                <FaCheckCircle />{" "}
                {ttsLoading
                  ? "Loading..."
                  : isSpeaking
                  ? "Playing..."
                  : "Listen"}
              </button>
            </div>
            <p>{llmResponse}</p>
          </div>
        )}

        {error && <div className="error-message">{error}</div>}
      </div>
    </div>
  );
};

export default UploadPDF;
