import React, { useState } from "react";
import { FaCalendarAlt, FaLightbulb, FaProjectDiagram } from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import logo from "../assets/logo.png";
import "./CreativeMode.css";
import Footer from "./Footer";

const AcademicRoadmap = () => {
  const navigate = useNavigate();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [academicInfo, setAcademicInfo] = useState({
    name: "",
    currentGrade: "",
    subjects: [],
    strengths: [],
    weaknesses: [],
    remainingModules: [],
  });

  const [studyPlan, setStudyPlan] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setAcademicInfo((prev) => ({
      ...prev,
      [name]: value,
    }));
    setError(null);
  };

  const handleArrayInput = (e, field) => {
    const values = e.target.value
      .split(",")
      .map((item) => item.trim())
      .filter((item) => item !== "");
    setAcademicInfo((prev) => ({
      ...prev,
      [field]: values,
    }));
    setError(null);
  };

  const validateInputs = () => {
    const requiredFields = [
      "name",
      "currentGrade",
      "subjects",
      "strengths",
      "weaknesses",
      "remainingModules",
    ];
    for (const field of requiredFields) {
      if (
        !academicInfo[field] ||
        (Array.isArray(academicInfo[field]) && academicInfo[field].length === 0)
      ) {
        return `Please fill in the ${field
          .replace(/([A-Z])/g, " $1")
          .toLowerCase()} field.`;
      }
    }
    return null;
  };

  const transformStudyPlan = (data) => {
    const timeline = data.timeline || {};
    const recommendations = data.recommendations || {};
    const moduleDependencies = data.moduleDependencies || {};

    const timelineArray = Object.keys(timeline).map((weekKey) => {
      const entry = timeline[weekKey];
      return {
        week: weekKey,
        subject: entry.Focus || "Overall review",
        description: entry.Activities
          ? entry.Activities.join("; ")
          : "No activities specified",
        resources: entry.Activities
          ? entry.Activities.filter((activity) =>
              activity.toLowerCase().includes("online")
            )
          : [],
      };
    });

    const recommendationsArray = Object.keys(recommendations).map(
      (key, index) => {
        const recValue = recommendations[key];
        const description = Array.isArray(recValue)
          ? recValue.join("; ")
          : recValue;
        return {
          title: `Recommendation ${index + 1}`,
          description: description || "No recommendation available",
          tips: description
            ? description
                .split(".")
                .map((tip) => tip.trim())
                .filter((tip) => tip)
            : [],
        };
      }
    );

    const moduleDependenciesArray = Object.keys(moduleDependencies).map(
      (module) => ({
        module,
        dependsOn: moduleDependencies[module].dependentModules || [],
        prerequisites: moduleDependencies[module].prerequisites || [],
      })
    );

    return {
      timeline: timelineArray,
      recommendations: recommendationsArray,
      moduleDependencies: moduleDependenciesArray,
    };
  };

  const generateRoadmap = async () => {
    const validationError = validateInputs();
    if (validationError) {
      setError(validationError);
      return;
    }

    const fallbackData = {
      timeline: {
        "Week 1": {
          Focus: "IT Law Basics",
          Activities: [
            "Read Chapter 1 of IT Law textbook",
            "Watch introductory videos on IT Law",
            "Take notes on key concepts",
          ],
        },
        "Week 2": {
          Focus: "Cyberlaw Introduction",
          Activities: [
            "Study Cyberlaw fundamentals",
            "Complete online quizzes",
            "Participate in discussion forums",
          ],
        },
        "Week 3": {
          Focus: "Green Computing Overview",
          Activities: [
            "Read Green Computing articles",
            "Watch case study videos",
            "Summarize key points",
          ],
        },
        "Week 4": {
          Focus: "Data Science Foundations",
          Activities: [
            "Learn basic Data Science concepts",
            "Practice with sample datasets",
            "Join a Data Science webinar",
          ],
        },
        "Week 5": {
          Focus: "IT Law and Cyberlaw Review",
          Activities: [
            "Review IT Law and Cyberlaw topics",
            "Create a comparison chart",
            "Discuss with peers",
          ],
        },
        "Week 6": {
          Focus: "Final Revision",
          Activities: [
            "Revise all subjects",
            "Take mock tests",
            "Prepare for final assessments",
          ],
        },
      },
      recommendations: {
        "Daily Study": "Allocate at least 1-2 hours of study time each day.",
        "Peer Study Groups":
          "Join or form a study group for collaborative learning.",
        "Utilize Online Resources":
          "Explore online platforms for additional materials and practice.",
        "Regular Breaks":
          "Incorporate breaks to avoid burnout and enhance retention.",
      },
      moduleDependencies: {
        "IT Law": {
          prerequisites: [],
          dependentModules: ["Cyberlaw"],
        },
        Cyberlaw: {
          prerequisites: ["IT Law"],
          dependentModules: [],
        },
        "Green Computing": {
          prerequisites: [],
          dependentModules: ["Data Science"],
        },
        "Data Science": {
          prerequisites: ["Green Computing"],
          dependentModules: [],
        },
      },
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      controller.abort();
      setError("Request timed out. Please try again.");
      setLoading(false);
    }, 35000);

    try {
      setLoading(true);
      setError(null);

      const response = await fetch("http://localhost:5000/api/roadmap", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: academicInfo.name,
          currentGrade: academicInfo.currentGrade,
          subjects: academicInfo.subjects,
          strengths: academicInfo.strengths,
          weaknesses: academicInfo.weaknesses,
          remainingModules: academicInfo.remainingModules,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const data = response.ok ? await response.json() : fallbackData;

      if (!response.ok) {
        throw new Error(data.error || `HTTP error! status: ${response.status}`);
      }

      // Ensure all required data fields exist
      const timeline = data.timeline || {};
      const recommendations = data.recommendations || {};
      const moduleDependencies = data.moduleDependencies || {};

      // Transform timeline data
      const timelineArray = Object.keys(timeline).map((weekKey) => {
        const entry = timeline[weekKey];
        return {
          week: weekKey,
          subject: entry.Focus || "Overall review",
          description: entry.Activities
            ? entry.Activities.join("; ")
            : "No activities specified",
          resources: entry.Activities
            ? entry.Activities.filter((activity) =>
                activity.toLowerCase().includes("online")
              )
            : [],
        };
      });

      // Transform recommendations
      const recommendationsArray = Object.keys(recommendations).map(
        (key, index) => {
          const recValue = recommendations[key];
          const description = Array.isArray(recValue)
            ? recValue.join("; ")
            : recValue;
          return {
            title: `Recommendation ${index + 1}`,
            description: description || "No recommendation available",
            tips: description
              ? description
                  .split(".")
                  .map((tip) => tip.trim())
                  .filter((tip) => tip)
              : [],
          };
        }
      );

      // Transform module dependencies
      const moduleDependenciesArray = Object.keys(moduleDependencies).map(
        (module) => ({
          module,
          dependsOn: moduleDependencies[module].dependentModules || [],
          prerequisites: moduleDependencies[module].prerequisites || [],
        })
      );

      // Update state with transformed data
      setStudyPlan({
        timeline: timelineArray,
        recommendations: recommendationsArray,
        moduleDependencies: moduleDependenciesArray,
      });
    } catch (error) {
      console.error("Error generating roadmap:", error);
      setError(
        error.message.includes("AI service timeout")
          ? "The AI service is currently unavailable. Please try again later."
          : `Failed to generate roadmap: ${error.message}`
      );
      setStudyPlan(transformStudyPlan(fallbackData));
    } finally {
      setLoading(false);
    }
  };

  const renderStudyPlan = () => {
    if (!studyPlan) {
      return <p>No study plan available. Please generate a roadmap.</p>;
    }

    return (
      <div className="study-plan glass-card">
        <div className="timeline-section">
          <h3>
            <FaCalendarAlt /> Study Timeline
          </h3>
          {studyPlan.timeline.length > 0 ? (
            <div className="timeline">
              {studyPlan.timeline.map((item, index) => (
                <div key={index} className="timeline-item glass-card">
                  <div className="timeline-date">{item.week}</div>
                  <div className="timeline-content">
                    <h4>{item.subject}</h4>
                    <p>{item.description}</p>
                    {item.resources.length > 0 ? (
                      <div className="timeline-resources">
                        {item.resources.map((resource, idx) => (
                          <span key={idx} className="resource-tag">
                            {resource}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p>No online resources specified.</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p>No timeline available.</p>
          )}
        </div>

        <div className="recommendations-section">
          <h3>
            <FaLightbulb /> AI Recommendations
          </h3>
          {studyPlan.recommendations.length > 0 ? (
            <div className="recommendations">
              {studyPlan.recommendations.map((rec, index) => (
                <div key={index} className="recommendation-card glass-card">
                  <h4>{rec.title}</h4>
                  <p>{rec.description}</p>
                  {rec.tips.length > 0 ? (
                    <ul>
                      {rec.tips.map((tip, idx) => (
                        <li key={idx}>{tip}</li>
                      ))}
                    </ul>
                  ) : (
                    <p>No specific tips available.</p>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p>No recommendations available.</p>
          )}
        </div>

        <div className="dependencies-section">
          <h3>
            <FaProjectDiagram /> Module Dependencies
          </h3>
          {studyPlan.moduleDependencies.length > 0 ? (
            <div className="dependencies-graph">
              {studyPlan.moduleDependencies.map((dep, index) => (
                <div key={index} className="dependency-item glass-card">
                  <div className="module">{dep.module}</div>
                  <div className="prerequisites">
                    <strong>Prerequisites:</strong>{" "}
                    {dep.prerequisites.length > 0
                      ? dep.prerequisites.map((prereq, idx) => (
                          <span key={idx} className="dependency-tag">
                            {prereq}
                          </span>
                        ))
                      : "None"}
                  </div>
                  <div className="depends-on">
                    <strong>Depends On:</strong>{" "}
                    {dep.dependsOn.length > 0
                      ? dep.dependsOn.map((d, idx) => (
                          <span key={idx} className="dependency-tag">
                            {d}
                          </span>
                        ))
                      : "None"}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p>No dependencies available.</p>
          )}
        </div>
      </div>
    );
  };

  return (
    <div>
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
                navigate("/LandingPage");
                setIsMenuOpen(false);
              }}
            >
              Home
            </button>
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
        className="creative-mode-container glass-card"
        style={{ marginTop: "13em", marginBottom: "13em" }}
      >
        <h2 style={{ textAlign: "center", marginBottom: "2em" }}>
          <b style={{ fontSize: "1.5em" }}>Academic Roadmap Generator</b>
        </h2>

        {error && (
          <div
            className="error-message"
            style={{ color: "red", textAlign: "center", marginBottom: "1em" }}
          >
            {error}
            {error.includes("AI service is currently unavailable") && (
              <button
                onClick={generateRoadmap}
                style={{ marginLeft: "10px", color: "#6366f1" }}
              >
                Retry
              </button>
            )}
          </div>
        )}

        <div className="input-section">
          <div className="form-group">
            <label>Name:</label>
            <input
              type="text"
              name="name"
              value={academicInfo.name}
              onChange={handleInputChange}
              placeholder="Enter your name"
              className="input"
            />
          </div>

          <div className="form-group">
            <label>Current Grade/Year:</label>
            <input
              type="text"
              name="currentGrade"
              value={academicInfo.currentGrade}
              onChange={handleInputChange}
              placeholder="e.g., 10th Grade, 2nd Year"
              className="input"
            />
          </div>

          <div className="form-group">
            <label>Subjects (comma-separated):</label>
            <input
              type="text"
              name="subjects"
              value={academicInfo.subjects.join(", ")}
              onChange={(e) => handleArrayInput(e, "subjects")}
              placeholder="e.g., Mathematics, Physics, Chemistry"
              className="input"
            />
          </div>

          <div className="form-group">
            <label>Strengths (comma-separated):</label>
            <input
              type="text"
              name="strengths"
              value={academicInfo.strengths.join(", ")}
              onChange={(e) => handleArrayInput(e, "strengths")}
              placeholder="e.g., Problem Solving, Critical Thinking"
              className="input"
            />
          </div>

          <div className="form-group">
            <label>Weaknesses (comma-separated):</label>
            <input
              type="text"
              name="weaknesses"
              value={academicInfo.weaknesses.join(", ")}
              onChange={(e) => handleArrayInput(e, "weaknesses")}
              placeholder="e.g., Time Management, Memorization"
              className="input"
            />
          </div>

          <div className="form-group">
            <label>Remaining Modules (comma-separated):</label>
            <input
              type="text"
              name="remainingModules"
              value={academicInfo.remainingModules.join(", ")}
              onChange={(e) => handleArrayInput(e, "remainingModules")}
              placeholder="e.g., Calculus, Organic Chemistry"
              className="input"
            />
          </div>

          <div style={{ textAlign: "center" }}>
            <button
              className="generate-button button"
              onClick={generateRoadmap}
              disabled={loading}
            >
              {loading ? (
                <>
                  <span className="loading-spinner"></span> Generating...
                </>
              ) : (
                "Generate Roadmap"
              )}
            </button>
          </div>
        </div>

        {studyPlan && (
          <div className="roadmap-visualization glass-card">
            {renderStudyPlan()}
          </div>
        )}
      </div>
      <Footer />
    </div>
  );
};

export default AcademicRoadmap;
