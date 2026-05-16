import { Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "./context/AuthContext";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";

function ProtectedRoute({ children }) {
  const { isAuth } = useAuth();
  return isAuth ? children : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <div className="app-shell">
      <div className="app-content">
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route
            path="/*"
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            }
          />
        </Routes>
      </div>
      <footer className="site-footer">
        <div className="site-footer-inner">
          <span className="footer-label">Crafted by</span>
          <a
            className="footer-link"
            href="https://tarikul.dev/"
            target="_blank"
            rel="noreferrer"
          >
            TARIKUL ISLAM
          </a>
        </div>
      </footer>
    </div>
  );
}
