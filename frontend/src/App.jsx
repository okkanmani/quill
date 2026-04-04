import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Login from "./pages/Login";
import StudentHome from "./pages/StudentHome";
import AdminHome from "./pages/AdminHome";
import AdminWorksheets from "./pages/AdminWorksheets";
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
          path="/admin/worksheets"
          element={
            <ProtectedRoute role="admin">
              <AdminWorksheets />
            </ProtectedRoute>
          }
        />

        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </BrowserRouter>
  );
}
