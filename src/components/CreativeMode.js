import {
  CategoryScale,
  Chart as ChartJS,
  Legend,
  LinearScale,
  LineElement,
  PointElement,
  Title,
  Tooltip,
} from 'chart.js';
import React, { useState } from 'react';
import { Line } from 'react-chartjs-2';
import { FaBook, FaCalendarAlt, FaLightbulb, FaProjectDiagram } from 'react-icons/fa';
import './CreativeMode.css';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

const CreativeMode = () => {
  const [academicInfo, setAcademicInfo] = useState({
    name: '',
    currentGrade: '',
    subjects: [],
    strengths: [],
    weaknesses: [],
    remainingModules: [],
  });

  const [roadmap, setRoadmap] = useState(null);
  const [studyPlan, setStudyPlan] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [activeTab, setActiveTab] = useState('progress');
  const [loading, setLoading] = useState(false);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setAcademicInfo(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleArrayInput = (e, field) => {
    const values = e.target.value.split(',').map(item => item.trim());
    setAcademicInfo(prev => ({
      ...prev,
      [field]: values
    }));
  };

  const generateRoadmap = async () => {
    try {
      setLoading(true);
      const response = await fetch('http://localhost:5000/api/roadmap', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: academicInfo.name,
          currentGrade: academicInfo.currentGrade,
          subjects: academicInfo.subjects,
          strengths: academicInfo.strengths,
          weaknesses: academicInfo.weaknesses,
          remainingModules: academicInfo.remainingModules
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || `HTTP error! status: ${response.status}`);
      }

      const chartData = {
        labels: ['Week 1', 'Week 2', 'Week 3', 'Week 4', 'Week 5', 'Week 6'],
        datasets: academicInfo.subjects.map((subject, index) => ({
          label: subject,
          data: data.progressData[subject] || Array.from({ length: 6 }, () => Math.random() * 100),
          borderColor: `hsl(${index * 60}, 70%, 50%)`,
          backgroundColor: `hsla(${index * 60}, 70%, 50%, 0.2)`,
          tension: 0.4,
          pointRadius: 5,
          pointHoverRadius: 8,
          pointBackgroundColor: '#fff',
          pointBorderWidth: 2,
        })),
      };
      
      setRoadmap(chartData);
      setStudyPlan({
        timeline: data.timeline,
        recommendations: data.recommendations,
        moduleDependencies: data.moduleDependencies
      });
    } catch (error) {
      console.error('Error generating roadmap:', error);
      alert(`Failed to generate roadmap: ${error.message}`);
      const mockRoadmap = {
        labels: ['Week 1', 'Week 2', 'Week 3', 'Week 4', 'Week 5', 'Week 6'],
        datasets: academicInfo.subjects.map((subject, index) => ({
          label: subject,
          data: Array.from({ length: 6 }, () => Math.random() * 100),
          borderColor: `hsl(${index * 60}, 70%, 50%)`,
          backgroundColor: `hsla(${index * 60}, 70%, 50%, 0.2)`,
          tension: 0.4,
          pointRadius: 5,
          pointHoverRadius: 8,
          pointBackgroundColor: '#fff',
          pointBorderWidth: 2,
        })),
      };
      setRoadmap(mockRoadmap);
    } finally {
      setLoading(false);
    }
  };

  const renderStudyPlan = () => {
    if (!studyPlan) return null;

    return (
      <div className="study-plan glass-card">
        <div className="timeline-section">
          <h3><FaCalendarAlt /> Study Timeline</h3>
          <div className="timeline">
            {studyPlan.timeline.map((item, index) => (
              <div key={index} className="timeline-item glass-card">
                <div className="timeline-date">{item.week}</div>
                <div className="timeline-content">
                  <h4>{item.subject}</h4>
                  <p>{item.description}</p>
                  <div className="timeline-resources">
                    {item.resources?.map((resource, idx) => (
                      <span key={idx} className="resource-tag">{resource}</span>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="recommendations-section">
          <h3><FaLightbulb /> AI Recommendations</h3>
          <div className="recommendations">
            {studyPlan.recommendations.map((rec, index) => (
              <div key={index} className="recommendation-card glass-card">
                <h4>{rec.title}</h4>
                <p>{rec.description}</p>
                {rec.tips && (
                  <ul>
                    {rec.tips.map((tip, idx) => (
                      <li key={idx}>{tip}</li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="dependencies-section">
          <h3><FaProjectDiagram /> Module Dependencies</h3>
          <div className="dependencies-graph">
            {studyPlan.moduleDependencies.map((dep, index) => (
              <div key={index} className="dependency-item glass-card">
                <div className="module">{dep.module}</div>
                <div className="depends-on">
                  {dep.dependsOn.map((d, idx) => (
                    <span key={idx} className="dependency-tag">{d}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="creative-mode-container glass-card">
      <h2>Academic Roadmap Generator</h2>
      
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
            value={academicInfo.subjects.join(', ')}
            onChange={(e) => handleArrayInput(e, 'subjects')}
            placeholder="e.g., Mathematics, Physics, Chemistry"
            className="input"
          />
        </div>

        <div className="form-group">
          <label>Strengths (comma-separated):</label>
          <input
            type="text"
            name="strengths"
            value={academicInfo.strengths.join(', ')}
            onChange={(e) => handleArrayInput(e, 'strengths')}
            placeholder="e.g., Problem Solving, Critical Thinking"
            className="input"
          />
        </div>

        <div className="form-group">
          <label>Weaknesses (comma-separated):</label>
          <input
            type="text"
            name="weaknesses"
            value={academicInfo.weaknesses.join(', ')}
            onChange={(e) => handleArrayInput(e, 'weaknesses')}
            placeholder="e.g., Time Management, Memorization"
            className="input"
          />
        </div>

        <div className="form-group">
          <label>Remaining Modules (comma-separated):</label>
          <input
            type="text"
            name="remainingModules"
            value={academicInfo.remainingModules.join(', ')}
            onChange={(e) => handleArrayInput(e, 'remainingModules')}
            placeholder="e.g., Calculus, Organic Chemistry"
            className="input"
          />
        </div>

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
            'Generate Roadmap'
          )}
        </button>
      </div>

      {roadmap && (
        <div className="roadmap-visualization glass-card">
          <div className="visualization-tabs">
            <button 
              className={`tab-button ${activeTab === 'progress' ? 'active' : ''}`}
              onClick={() => setActiveTab('progress')}
            >
              <FaBook /> Progress Chart
            </button>
            <button 
              className={`tab-button ${activeTab === 'plan' ? 'active' : ''}`}
              onClick={() => setActiveTab('plan')}
            >
              <FaCalendarAlt /> Study Plan
            </button>
          </div>

          <div className="tab-content">
            {activeTab === 'progress' && (
              <div className="chart-container">
                <Line
                  data={roadmap}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                      legend: {
                        position: 'top',
                        labels: {
                          font: {
                            size: 14,
                            family: 'Inter',
                          },
                          padding: 20,
                          usePointStyle: true,
                          pointStyle: 'circle',
                          boxWidth: 8,
                        },
                      },
                      title: {
                        display: true,
                        text: 'Academic Progress Over Time',
                        font: {
                          size: 20,
                          family: 'Inter',
                          weight: '600',
                        },
                        padding: {
                          top: 10,
                          bottom: 20,
                        },
                        color: 'var(--text-primary)',
                      },
                      tooltip: {
                        backgroundColor: 'rgba(0, 0, 0, 0.85)',
                        padding: 12,
                        titleFont: {
                          size: 14,
                          family: 'Inter',
                          weight: '600',
                        },
                        bodyFont: {
                          size: 13,
                          family: 'Inter',
                        },
                        callbacks: {
                          label: function(context) {
                            return `${context.dataset.label}: ${context.parsed.y.toFixed(1)}%`;
                          },
                        },
                      },
                    },
                    scales: {
                      y: {
                        beginAtZero: true,
                        max: 100,
                        title: {
                          display: true,
                          text: 'Completion (%)',
                          font: {
                            size: 14,
                            family: 'Inter',
                            weight: '600',
                          },
                          padding: 10,
                          color: 'var(--text-primary)',
                        },
                        ticks: {
                          font: {
                            size: 12,
                            family: 'Inter',
                          },
                          callback: function(value) {
                            return value + '%';
                          },
                          color: 'var(--text-secondary)',
                        },
                        grid: {
                          color: 'rgba(0, 0, 0, 0.05)',
                          borderColor: 'var(--border)',
                        },
                      },
                      x: {
                        title: {
                          display: true,
                          text: 'Timeline (Weeks)',
                          font: {
                            size: 14,
                            family: 'Inter',
                            weight: '600',
                          },
                          padding: 10,
                          color: 'var(--text-primary)',
                        },
                        ticks: {
                          font: {
                            size: 12,
                            family: 'Inter',
                          },
                          color: 'var(--text-secondary)',
                        },
                        grid: {
                          color: 'rgba(0, 0, 0, 0.05)',
                          borderColor: 'var(--border)',
                        },
                      },
                    },
                    interaction: {
                      mode: 'index',
                      intersect: false,
                    },
                    elements: {
                      line: {
                        tension: 0.4,
                        borderWidth: 3,
                      },
                      point: {
                        radius: 5,
                        hoverRadius: 8,
                        borderWidth: 2,
                        backgroundColor: '#fff',
                      },
                    },
                    animation: {
                      duration: 1000,
                      easing: 'easeOutQuart',
                    },
                  }}
                />
              </div>
            )}

            {activeTab === 'plan' && renderStudyPlan()}
          </div>
        </div>
      )}
    </div>
  );
};

export default CreativeMode;