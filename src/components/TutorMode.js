import React, { useState } from "react";
import { FaChevronDown, FaChevronUp, FaVolumeUp } from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import logo from "../assets/logo.png";
import "./CreativeMode.css";
import PDFProcessor from "./PDFProcessor";

const TutorMode = () => {
  const navigate = useNavigate();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [subject, setSubject] = useState("");
  const [pdfTexts, setPdfTexts] = useState([]);
  const [analyzing, setAnalyzing] = useState(false);
  const [sessions, setSessions] = useState([]);
  const [error, setError] = useState("");
  const [expanded, setExpanded] = useState({});
  const [ttsLoading, setTtsLoading] = useState(null);

  const handlePDFProcessed = (text) => {
    setPdfTexts((prev) => [...prev, text]);
  };

  const handleAnalyze = async () => {
    setAnalyzing(true);
    setError("");
    setSessions([]);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      controller.abort();
      setError("Request timed out. Please try again.");
      setAnalyzing(false);
    }, 35000); // Slightly longer than backend timeout

    try {
      const response = await fetch("http://localhost:5000/api/tutor/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject,
          content: pdfTexts.join("\n\n"),
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to analyze content");
      }
      setSessions(data.sessions || []);
    } catch (err) {
      if (err.name === "AbortError") {
        return; // Timeout error already handled
      }
      setError(
        err.message.includes("API timeout")
          ? "The AI service is currently unavailable. Please try again later or upload a smaller PDF."
          : `Failed to generate tutor sessions: ${err.message}`
      );
    } finally {
      setAnalyzing(false);
    }
  };

  const handleTTS = async (text, idx) => {
    setTtsLoading(idx);
    try {
      const response = await fetch("http://localhost:5000/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      if (!response.ok) throw new Error("Failed to fetch TTS audio");
      const { audio } = await response.json();

      const audioBlob = new Blob(
        [Uint8Array.from(atob(audio), (c) => c.charCodeAt(0))],
        { type: "audio/mp3" }
      );
      const audioUrl = URL.createObjectURL(audioBlob);
      const audioObj = new Audio(audioUrl);
      audioObj.play();
    } catch (err) {
      setError("TTS failed: " + err.message);
    } finally {
      setTtsLoading(null);
    }
  };

  const toggleExpand = (idx) => {
    setExpanded((prev) => ({ ...prev, [idx]: !prev[idx] }));
  };

  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      <div className="navbar">
        <div className="navbar-title">
          <img
            src={logo}
            alt="CampuPal-AI Logo"
            style={{ width: "60px", marginRight: "10px" }}
          />
          CampusPal-AI
        </div>
        <div
          className={`hamburger-icon ${isMenuOpen ? "open" : ""}`}
          onClick={() => setIsMenuOpen(!isMenuOpen)}
        >
          <span></span>
          <span></span>
          <span></span>
        </div>
        {isMenuOpen && (
          <div className="dropdown-menu">
            <button
              onClick={() => {
                navigate("/tutor");
                setIsMenuOpen(false);
              }}
            >
              Tutor Mode
            </button>
            <button
              onClick={() => {
                navigate("/roadmap");
                setIsMenuOpen(false);
              }}
            >
              Academic Roadmap
            </button>
            <button
              onClick={() => {
                navigate("/upload");
                setIsMenuOpen(false);
              }}
            >
              Upload PDF
            </button>
          </div>
        )}
      </div>
      <div
        className="creative-mode-container"
        style={{ marginTop: "12em", marginBottom: "12em" }}
      >
        <h2>Tutor Mode: AI-Powered Subject Breakdown</h2>
        <div className="input-section">
          <div className="form-group">
            <label>Subject Name:</label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="e.g., Data Structures, Law, Physics"
              style={{ color: "black", textAlign: "center" }}
            />
          </div>
          <div className="form-group">
            <label>Upload all study materials (PDFs):</label>
            <PDFProcessor onPDFProcessed={handlePDFProcessed} />
            <div style={{ marginTop: 8, color: "#6366f1", fontWeight: 500 }}>
              {pdfTexts.length > 0 && `${pdfTexts.length} PDF(s) processed.`}
            </div>
          </div>
          <button
            className="generate-button"
            onClick={handleAnalyze}
            disabled={!subject || pdfTexts.length === 0 || analyzing}
          >
            {analyzing
              ? "Analyzing & Generating Sessions..."
              : "Generate Tutor Sessions"}
          </button>
        </div>
        {error && (
          <div className="error-message">
            {error}
            {error.includes("AI service is currently unavailable") && (
              <button
                onClick={handleAnalyze}
                style={{ marginLeft: "10px", color: "#6366f1" }}
              >
                Retry
              </button>
            )}
          </div>
        )}
        {sessions.length > 0 && (
          <div className="roadmap-visualization">
            <h3 style={{ textAlign: "center", marginBottom: 24 }}>
              Session-wise Breakdown
            </h3>
            {sessions.map((session, idx) => (
              <div
                key={idx}
                className="tab-content"
                style={{ marginBottom: 24 }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    cursor: "pointer",
                  }}
                  onClick={() => toggleExpand(idx)}
                >
                  <h4 style={{ margin: 0, fontWeight: 700, color: "#4f46e5" }}>
                    Session {session.sessionNumber}: {session.title}
                  </h4>
                  <span>
                    {expanded[idx] ? <FaChevronUp /> : <FaChevronDown />}
                  </span>
                </div>
                {expanded[idx] && (
                  <div style={{ marginTop: 16 }}>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 12,
                        marginBottom: 8,
                      }}
                    >
                      <button
                        className="generate-button"
                        style={{
                          padding: "0.5rem 1.2rem",
                          fontSize: "1rem",
                          borderRadius: 24,
                          background: "#6366f1",
                          margin: 0,
                        }}
                        onClick={() =>
                          handleTTS(session.detailedExplanation, idx)
                        }
                        disabled={ttsLoading === idx}
                      >
                        <FaVolumeUp />{" "}
                        {ttsLoading === idx ? "Playing..." : "Listen"}
                      </button>
                    </div>
                    <div>
                      <b>Objectives:</b>{" "}
                      <ul>
                        {session.objectives?.map((o, i) => (
                          <li key={i}>{o}</li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <b>Key Concepts:</b>{" "}
                      <ul>
                        {session.keyConcepts?.map((k, i) => (
                          <li key={i}>{k}</li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <b>Detailed Explanation:</b>
                      <br />
                      <div style={{ whiteSpace: "pre-line", margin: "8px 0" }}>
                        {session.detailedExplanation}
                      </div>
                    </div>
                    <div>
                      <b>Suggested Notes:</b>
                      <br />
                      <div
                        style={{
                          whiteSpace: "pre-line",
                          margin: "8px 0",
                          color: "#2563eb",
                        }}
                      >
                        {session.suggestedNotes}
                      </div>
                    </div>
                    <div>
                      <b>Practice Questions:</b>{" "}
                      <ul>
                        {session.practiceQuestions?.map((q, i) => (
                          <li key={i}>{q}</li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <b>Resources:</b>{" "}
                      <ul>
                        {session.resources?.map((r, i) => (
                          <li key={i}>
                            <a
                              href={r}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              {r}
                            </a>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="footer" style={{ marginTop: "4em" }}>
        <span>© CampusPal-AI Inc. 2025</span>
      </div>
    </div>
  );
};

export default TutorMode;
