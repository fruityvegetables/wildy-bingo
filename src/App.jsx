import { BrowserRouter, Link, Navigate, Route, Routes } from 'react-router-dom';
import { getAppConfig, isDemoMode } from './lib/config.js';
import { AuthProvider } from './context/AuthContext.jsx';
import { useAuth } from './context/AuthContext.jsx';
import AuthForm from './components/AuthForm.jsx';
import ConfigMissing from './components/ConfigMissing.jsx';
import HomeView from './components/HomeView.jsx';
import HostGameView from './components/HostGameView.jsx';
import PlayerGameView from './components/PlayerGameView.jsx';
import DevRoutes from './demo/DevRoutes.jsx';
import './App.css';

function HomeRoute() {
  const { username, ready } = useAuth();

  if (!ready) {
    return <div className="loading-screen">Loading wilderness…</div>;
  }

  return username ? <HomeView /> : <AuthForm />;
}

function ProtectedRoute({ children }) {
  const { username, ready } = useAuth();
  if (!ready) return <div className="loading-screen">Loading wilderness…</div>;
  if (!username) return <Navigate to="/" replace />;
  return children;
}

export default function App() {
  const configured = getAppConfig().isConfigured || isDemoMode();

  return (
    <BrowserRouter>
      {isDemoMode() && (
        <div className="demo-banner stone-panel">
          Demo mode — <Link to="/dev">open page gallery</Link>
        </div>
      )}
      <AuthProvider>
        <Routes>
          {isDemoMode() && <Route path="/dev/*" element={<DevRoutes />} />}

          {!configured && <Route path="*" element={<ConfigMissing />} />}

          {configured && (
            <>
              <Route path="/" element={<HomeRoute />} />
              <Route
                path="/host/:gameId"
                element={
                  <ProtectedRoute>
                    <HostGameView />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/play/:gameId"
                element={
                  <ProtectedRoute>
                    <PlayerGameView />
                  </ProtectedRoute>
                }
              />
              <Route path="*" element={<Navigate to="/" replace />} />
            </>
          )}
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
