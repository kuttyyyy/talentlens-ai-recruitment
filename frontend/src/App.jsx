// App.jsx
// This file sets up all the "routes" (pages) in our application.
// React Router shows a different component depending on the URL.

import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Register from "./pages/Register";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import ResumeUpload from "./pages/ResumeUpload";
import CandidateProfile from "./pages/CandidateProfile";
import MyAssessments from "./pages/MyAssessments";
import TakeTest from "./pages/TakeTest";
import PostJob from "./pages/PostJob";
import BrowseJobs from "./pages/BrowseJobs";
import MyApplications from "./pages/MyApplications";
import Applicants from "./pages/Applicants";
import CandidateDetail from "./pages/CandidateDetail";
import RecruiterDashboard from "./pages/RecruiterDashboard";
import AdminDashboard from "./pages/AdminDashboard";
import Assessments from "./pages/Assessments";
import NewAssessment from "./pages/NewAssessment";
import AssessmentDetail from "./pages/AssessmentDetail";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/login" />} />
        <Route path="/register" element={<Register />} />
        <Route path="/login" element={<Login />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/upload-resume" element={<ResumeUpload />} />
        <Route path="/profile" element={<CandidateProfile />} />
        <Route path="/my-assessments" element={<MyAssessments />} />
        <Route path="/test/:applicationId/:testId" element={<TakeTest />} />
        <Route path="/post-job" element={<PostJob />} />
        <Route path="/browse-jobs" element={<BrowseJobs />} />
        <Route path="/my-applications" element={<MyApplications />} />
        <Route path="/applicants" element={<Applicants />} />
        <Route path="/applicants/:applicationId" element={<CandidateDetail />} />
        <Route path="/reports" element={<RecruiterDashboard />} />
        <Route path="/admin" element={<AdminDashboard />} />
        <Route path="/assessments" element={<Assessments />} />
        <Route path="/assessments/new" element={<NewAssessment />} />
        <Route path="/assessments/:assessmentId" element={<AssessmentDetail />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;