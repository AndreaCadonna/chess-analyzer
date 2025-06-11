// frontend/src/App.tsx - Updated with new routes
import { BrowserRouter as Router, Routes, Route, Link } from "react-router-dom";
import { useState, useEffect } from "react";
import { healthCheck } from "./services/api";
import UserManagement from "./pages/UserManagement";
import ImportPage from "./pages/ImportPage";
import GamesList from "./pages/GamesList";
import "./App.css";

interface HealthStatus {
  status: string;
  timestamp: string;
  services: {
    database: string;
    api: string;
  };
}

function App() {
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const checkHealth = async () => {
      try {
        const healthData = await healthCheck();
        setHealth(healthData);
        setError(null);
      } catch (err) {
        setError("Failed to connect to backend");
        console.error("Health check failed:", err);
      } finally {
        setLoading(false);
      }
    };

    checkHealth();
  }, []);

  if (loading) {
    return <div className="loading">Checking system health...</div>;
  }

  return (
    <Router>
      <div className="App">
        <header className="App-header">
          <div className="header-content">
            <h1>
              <Link to="/" className="logo-link">
                Chess Analyzer
              </Link>
            </h1>

            <nav className="main-nav">
              <Link to="/users" className="nav-link">
                Users
              </Link>
            </nav>

            <div className="health-status">
              {error ? (
                <span className="error">❌ {error}</span>
              ) : health ? (
                <span className="success">
                  ✅ {health.status} | DB: {health.services.database}
                </span>
              ) : null}
            </div>
          </div>
        </header>

        <main className="main-content">
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/users" element={<UserManagement />} />
            <Route path="/import/:userId" element={<ImportPage />} />
            <Route path="/games/:userId" element={<GamesList />} />
          </Routes>
        </main>

        <footer className="app-footer">
          <p>
            &copy; 2025 Chess Analyzer - Improve your chess with deep analysis
          </p>
        </footer>
      </div>
    </Router>
  );
}

const HomePage = () => {
  return (
    <div className="home">
      <div className="hero-section">
        <h2>Welcome to Chess Analyzer</h2>
        <p className="hero-description">
          Import your chess games from Chess.com and get detailed analysis to
          improve your gameplay with professional insights.
        </p>

        <div className="feature-grid">
          <div className="feature-card">
            <h3>🔄 Game Import</h3>
            <p>
              Seamlessly import all your games from Chess.com with just a
              username
            </p>
          </div>

          <div className="feature-card">
            <h3>🤖 Engine Analysis</h3>
            <p>
              Deep position analysis powered by Stockfish engine (Coming Soon)
            </p>
          </div>

          <div className="feature-card">
            <h3>📊 Performance Insights</h3>
            <p>
              Track your progress and identify improvement opportunities (Coming
              Soon)
            </p>
          </div>

          <div className="feature-card">
            <h3>🎯 Mistake Detection</h3>
            <p>
              Automatically find blunders, mistakes, and missed opportunities
              (Coming Soon)
            </p>
          </div>
        </div>

        <div className="cta-section">
          <h3>Get Started</h3>
          <p>Ready to analyze your chess games?</p>
          <Link to="/users" className="cta-button">
            Manage Users & Import Games
          </Link>
        </div>

        <div className="status-section">
          <h3>📈 Development Status</h3>
          <div className="progress-list">
            <div className="progress-item completed">
              <span className="progress-icon">✅</span>
              <span className="progress-text">
                Step 1: Foundation & Architecture
              </span>
            </div>
            <div className="progress-item completed">
              <span className="progress-icon">✅</span>
              <span className="progress-text">
                Step 2: Chess.com API Integration
              </span>
            </div>
            <div className="progress-item upcoming">
              <span className="progress-icon">🔄</span>
              <span className="progress-text">
                Step 3: Stockfish Engine Analysis
              </span>
            </div>
            <div className="progress-item upcoming">
              <span className="progress-icon">⏳</span>
              <span className="progress-text">
                Step 4: Interactive Chess Board
              </span>
            </div>
            <div className="progress-item upcoming">
              <span className="progress-icon">⏳</span>
              <span className="progress-text">Step 5: Analytics Dashboard</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default App;
