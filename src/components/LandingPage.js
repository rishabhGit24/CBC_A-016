import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import roadmap from "../assets/roadmap.png";
import tutor from "../assets/tutor.png";
import pdf from "../assets/upload.png";
import CentralBot from "./CentralBot";
import "./LandingPage.css";

const LandingPage = () => {
  const navigate = useNavigate();
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [user, setUser] = useState(null);

  useEffect(() => {
    // Check if user is logged in
    const token = localStorage.getItem("token");
    const userData = localStorage.getItem("user");

    if (token && userData) {
      setIsLoggedIn(true);
      setUser(JSON.parse(userData));
    }
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setIsLoggedIn(false);
    setUser(null);
  };

  return (
    <div className="landing-container" style={{ marginTop: "10em" }}>
      <div
        className="landing-header"
        style={{
          textAlign: "center",
          fontWeight: "bold",
          color: "black",
          fontSize: "1.5em",
        }}
      >
        <h1 style={{ fontSize: "2.5em" }}>CampusPalAI</h1>
        <p style={{ fontSize: "1em" }}>
          Your Ultimate AI-powered study companion
        </p>
      </div>
      <div style={{ marginRight: "-1em" }}>
        <CentralBot />
      </div>
      <div className="landing-buttons">
        <div className="lnd-btn" style={{ height: "100%" }}>
          <img src={pdf} alt="PDF" width="250px" />
          <p>
            Upload PDF <br></br>Get Started Learn about hosting built for scale
            and reliability.
          </p>
          <button onClick={() => navigate("/tutor")}>Tutor Mode</button>
        </div>
        <div className="lnd-btn" style={{ height: "100%" }}>
          <img src={tutor} alt="Tutor" width="250px" height="220px" />
          <p>
            Tutor sessions<br></br>
            Learn how Framer can optimize your site for search engines.
          </p>
          <button onClick={() => navigate("/roadmap")}>Academic Roadmap</button>
        </div>
        <div className="lnd-btn" style={{ height: "100%" }}>
          <img src={roadmap} alt="Roadmap" width="250px" height="220px" />
          <p>
            Roadmaps<br></br>
            Get inspired by blogs, job openings, events and more.
          </p>
          <button onClick={() => navigate("/upload")}>Upload PDF</button>
        </div>
      </div>
    </div>
  );
};

export default LandingPage;
