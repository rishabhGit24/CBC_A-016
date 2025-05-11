import React from 'react';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import { Route, BrowserRouter as Router, Routes } from 'react-router-dom';
import './App.css';
import AcademicRoadmap from './components/AcademicRoadmap';
import LandingPage from './components/LandingPage';
import Login from './components/Login';
import TutorMode from './components/TutorMode';
import UploadPDF from './components/UploadPDF';

function App() {
  return (
    <div className="App">
      <Navbar />
      <div className="content">
        <Router>
          <Routes>
            <Route path="/LandingPage" element={<LandingPage />} />
            <Route path="/" element={<Login />} />
            <Route path="/tutor" element={<TutorMode />} />
            <Route path="/roadmap" element={<AcademicRoadmap />} />
            <Route path="/upload" element={<UploadPDF />} />
          </Routes>
        </Router>
      </div>
      <Footer />
    </div>
  );
}

export default App;
