// App.jsx
// This file sets up all the "routes" (pages) in our application.
// React Router shows a different component depending on the URL.

import { BrowserRouter, Routes, Route } from "react-router-dom";
import LandingPage from "./pages/LandingPage";
import Register from "./pages/Register";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import ResumeUpload from "./pages/ResumeUpload";
import Verification from "./pages/Verification";
import RecruiterFeedback from "./pages/RecruiterFeedback";
import CandidateProfile from "./pages/CandidateProfile";
import MyAssessments from "./pages/MyAssessments";
import TakeTest from "./pages/TakeTest";
import PostJob from "./pages/PostJob";
import BrowseJobs from "./pages/BrowseJobs";
import MyApplications from "./pages/MyApplications";
import MyInterview from "./pages/MyInterview";
import Applicants from "./pages/Applicants";
import CandidateDetail from "./pages/CandidateDetail";
import RecruiterDashboard from "./pages/RecruiterDashboard";
import AdminDashboard from "./pages/AdminDashboard";
import Assessments from "./pages/Assessments";
import NewAssessment from "./pages/NewAssessment";
import AssessmentDetail from "./pages/AssessmentDetail";
import AdminPortalLogin from "./pages/AdminPortalLogin";
import AdminPortalDashboard from "./pages/AdminPortalDashboard";
import AdminPortalCompanies from "./pages/AdminPortalCompanies";
import AdminPortalRecruiters from "./pages/AdminPortalRecruiters";
import AdminPortalAuditLog from "./pages/AdminPortalAuditLog";
import AdminPortalFeedback from "./pages/AdminPortalFeedback";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/register" element={<Register />} />
        <Route path="/login" element={<Login />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/upload-resume" element={<ResumeUpload />} />
        <Route path="/verification" element={<Verification />} />
        <Route path="/feedback" element={<RecruiterFeedback />} />
        <Route path="/profile" element={<CandidateProfile />} />
        <Route path="/my-assessments" element={<MyAssessments />} />
        <Route path="/test/:applicationId/:testId" element={<TakeTest />} />
        <Route path="/post-job" element={<PostJob />} />
        <Route path="/browse-jobs" element={<BrowseJobs />} />
        <Route path="/my-applications" element={<MyApplications />} />
        <Route path="/interview/:applicationId" element={<MyInterview />} />
        <Route path="/applicants" element={<Applicants />} />
        <Route path="/applicants/:applicationId" element={<CandidateDetail />} />
        <Route path="/reports" element={<RecruiterDashboard />} />
        <Route path="/admin" element={<AdminDashboard />} />
        <Route path="/assessments" element={<Assessments />} />
        <Route path="/assessments/new" element={<NewAssessment />} />
        <Route path="/assessments/:assessmentId" element={<AssessmentDetail />} />

        {/* Admin Portal -- deliberately NOT linked from any nav on the public site.
            Reachable only by navigating here directly; real security is the
            backend's role/token checks, not this route being unlisted. */}
        <Route path="/admin-portal/login" element={<AdminPortalLogin />} />
        <Route path="/admin-portal/dashboard" element={<AdminPortalDashboard />} />
        <Route path="/admin-portal/companies" element={<AdminPortalCompanies />} />
        <Route path="/admin-portal/recruiters" element={<AdminPortalRecruiters />} />
        <Route path="/admin-portal/audit-log" element={<AdminPortalAuditLog />} />
        <Route path="/admin-portal/feedback" element={<AdminPortalFeedback />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
