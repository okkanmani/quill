import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Login from "./pages/Login";
import StudentHome from "./pages/StudentHome";
import StudentLatest from "./pages/StudentLatest";
import StudentRevision from "./pages/StudentRevision";
import StudentRevisionWorksheet from "./pages/StudentRevisionWorksheet";
import StudentTests from "./pages/StudentTests";
import StudentTestTake from "./pages/StudentTestTake";
import StudentTestReview from "./pages/StudentTestReview";
import StudentResults from "./pages/StudentResults";
import StudentSettings from "./pages/StudentSettings";
import StudentWriting from "./pages/StudentWriting";
import AdminHome from "./pages/AdminHome";
import AdminAnalysis from "./pages/AdminAnalysis";
import AdminWorksheets from "./pages/AdminWorksheets";
import AdminCreate from "./pages/AdminCreate";
import AdminCreateWorksheet from "./pages/AdminCreateWorksheet";
import AdminCreateLearn from "./pages/AdminCreateLearn";
import AdminCreateUpload from "./pages/AdminCreateUpload";
import AdminCreateTest from "./pages/AdminCreateTest";
import AdminLearnEdit from "./pages/AdminLearnEdit";
import AdminStudents from "./pages/AdminStudents";
import AdminSettings from "./pages/AdminSettings";
import Worksheet from "./pages/Worksheet";
import LearnHub from "./pages/LearnHub";
import LearnSubject from "./pages/LearnSubject";
import ProtectedRoute from "./components/ProtectedRoute";
import AutoSignOut from "./components/AutoSignOut";

export default function App() {
  return (
    <BrowserRouter>
      <AutoSignOut>
        <Routes>
        <Route path="/" element={<Login />} />

        <Route
          path="/student"
          element={
            <ProtectedRoute role="student">
              <StudentHome />
            </ProtectedRoute>
          }
        />

        <Route
          path="/student/latest"
          element={
            <ProtectedRoute role="student">
              <StudentLatest />
            </ProtectedRoute>
          }
        />

        <Route
          path="/student/revision"
          element={
            <ProtectedRoute role="student">
              <StudentRevision />
            </ProtectedRoute>
          }
        />

        <Route
          path="/student/tests"
          element={
            <ProtectedRoute role="student">
              <StudentTests />
            </ProtectedRoute>
          }
        />

        <Route
          path="/student/tests/review/:id"
          element={
            <ProtectedRoute role="student">
              <StudentTestReview />
            </ProtectedRoute>
          }
        />

        <Route
          path="/student/tests/:id"
          element={
            <ProtectedRoute role="student">
              <StudentTestTake />
            </ProtectedRoute>
          }
        />

        <Route
          path="/student/revision/:id"
          element={
            <ProtectedRoute role="student">
              <StudentRevisionWorksheet />
            </ProtectedRoute>
          }
        />

        <Route
          path="/student/writing"
          element={
            <ProtectedRoute role="student">
              <StudentWriting />
            </ProtectedRoute>
          }
        />

        <Route
          path="/student/results"
          element={
            <ProtectedRoute role="student">
              <StudentResults />
            </ProtectedRoute>
          }
        />

        <Route
          path="/student/settings"
          element={
            <ProtectedRoute role="student">
              <StudentSettings />
            </ProtectedRoute>
          }
        />

        <Route
          path="/student/worksheet/:id"
          element={
            <ProtectedRoute role={["student", "admin"]}>
              <Worksheet />
            </ProtectedRoute>
          }
        />

        <Route
          path="/student/learn"
          element={
            <ProtectedRoute role={["student", "admin"]}>
              <LearnHub />
            </ProtectedRoute>
          }
        />

        <Route
          path="/student/learn/:subjectKey"
          element={
            <ProtectedRoute role={["student", "admin"]}>
              <LearnSubject />
            </ProtectedRoute>
          }
        />

        <Route
          path="/admin"
          element={
            <ProtectedRoute role="admin">
              <AdminHome />
            </ProtectedRoute>
          }
        />

        <Route
          path="/admin/analysis"
          element={
            <ProtectedRoute role="admin">
              <AdminAnalysis />
            </ProtectedRoute>
          }
        />

        <Route
          path="/admin/worksheets/builder"
          element={<Navigate to="/admin/create/worksheet" replace />}
        />

        <Route
          path="/admin/create/learn/edit/:subjectKey/:sectionId"
          element={
            <ProtectedRoute role="admin">
              <AdminLearnEdit />
            </ProtectedRoute>
          }
        />

        <Route
          path="/admin/create"
          element={
            <ProtectedRoute role="admin">
              <AdminCreate />
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="/admin/create/worksheet" replace />} />
          <Route path="worksheet" element={<AdminCreateWorksheet />} />
          <Route path="test" element={<AdminCreateTest />} />
          <Route path="upload" element={<AdminCreateUpload />} />
          <Route path="learn" element={<AdminCreateLearn />} />
        </Route>

        <Route
          path="/admin/worksheets"
          element={
            <ProtectedRoute role="admin">
              <AdminWorksheets />
            </ProtectedRoute>
          }
        />

        <Route
          path="/admin/settings"
          element={
            <ProtectedRoute role="admin">
              <AdminSettings />
            </ProtectedRoute>
          }
        />

        <Route
          path="/admin/students"
          element={
            <ProtectedRoute role="admin">
              <AdminStudents />
            </ProtectedRoute>
          }
        />

        <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </AutoSignOut>
    </BrowserRouter>
  );
}
