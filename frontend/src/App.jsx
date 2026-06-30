import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Login from "./pages/Login";
import StudentHome from "./pages/StudentHome";
import StudentLatest from "./pages/StudentLatest";
import AdminHome from "./pages/AdminHome";
import AdminWorksheets from "./pages/AdminWorksheets";
import AdminQuestionBuilder from "./pages/AdminQuestionBuilder";
import AdminStudents from "./pages/AdminStudents";
import AdminSettings from "./pages/AdminSettings";
import Worksheet from "./pages/Worksheet";
import LearnHub from "./pages/LearnHub";
import LearnSubject from "./pages/LearnSubject";
import ProtectedRoute from "./components/ProtectedRoute";

export default function App() {
  return (
    <BrowserRouter>
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
          path="/admin/worksheets/builder"
          element={
            <ProtectedRoute role="admin">
              <AdminQuestionBuilder />
            </ProtectedRoute>
          }
        />

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
    </BrowserRouter>
  );
}
