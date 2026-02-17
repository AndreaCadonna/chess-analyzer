// frontend/src/App.tsx
import { BrowserRouter as Router, Routes, Route, Link, useLocation } from "react-router-dom";
import { useState, useEffect } from "react";
import { healthCheck } from "./services/api";
import UserManagement from "./pages/UserManagement";
import ImportPage from "./pages/ImportPage";
import GamesList from "./pages/GamesList";
import GameAnalysisPage from "./pages/GameAnalysisPage";
import Button from "./components/ui/Button";
import "./App.css";

interface HealthStatus {
  status: string;
  timestamp: string;
  services: {
    database: string;
    api: string;
  };
}

const Breadcrumbs = () => {
  const location = useLocation();
  const segments = location.pathname.split("/").filter(Boolean);

  if (segments.length === 0) return null;

  const labels: Record<string, string> = {
    users: "Users",
    import: "Import",
    games: "Games",
    analysis: "Analysis",
  };

  return (
    <nav className="breadcrumbs" aria-label="Breadcrumb">
      <Link to="/" className="breadcrumb-link">Home</Link>
      {segments.map((seg, i) => {
        const label = labels[seg] || seg;
        const path = "/" + segments.slice(0, i + 1).join("/");
        const isLast = i === segments.length - 1;
        return (
          <span key={path}>
            <span className="breadcrumb-sep">/</span>
            {isLast ? (
              <span className="breadcrumb-current">{label}</span>
            ) : (
              <Link to={path} className="breadcrumb-link">{label}</Link>
            )}
          </span>
        );
      })}
    </nav>
  );
};

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

  const isHealthy = !error && health?.status === "ok";

  return (
    <Router>
      <div className="App">
        <header className="App-header">
          <div className="header-content">
            <Link to="/" className="logo-link">
              <span className="logo-icon">&#9822;</span>
              <span className="logo-text">Chess Analyzer</span>
            </Link>

            <nav className="main-nav">
              <Link to="/users" className="nav-link">Users</Link>
            </nav>

            <div className={`health-dot ${isHealthy ? "health-dot--ok" : "health-dot--error"}`}
              title={isHealthy ? "All systems operational" : error || "System error"}
            />
          </div>
          <Breadcrumbs />
        </header>

        <main className="main-content">
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/users" element={<UserManagement />} />
            <Route path="/import/:userId" element={<ImportPage />} />
            <Route path="/games/:userId" element={<GamesList />} />
            <Route path="/analysis/:gameId" element={<GameAnalysisPage />} />
          </Routes>
        </main>

        <footer className="app-footer">
          <p>&copy; {new Date().getFullYear()} Chess Analyzer</p>
        </footer>
      </div>
    </Router>
  );
}

const HomePage = () => {
  return (
    <div className="home">
      <div className="hero-section">
        <h2>Analyze Your Chess.<br />Improve Your Game.</h2>
        <p className="hero-description">
          Import games from Chess.com and get deep Stockfish analysis
          with move classification, accuracy metrics, and best-move arrows.
        </p>

        <div className="cta-section">
          <Button
            as={Link}
            to="/users"
            variant="primary"
            size="lg"
            rightIcon={<span>&#8594;</span>}
          >
            Get Started
          </Button>
        </div>

        <div className="how-it-works">
          <h3>How It Works</h3>
          <div className="steps-list">
            <div className="step-item">
              <span className="step-number">1</span>
              <span className="step-label">Import</span>
              <span className="step-text">Connect your Chess.com account and import games</span>
            </div>
            <div className="step-connector" />
            <div className="step-item">
              <span className="step-number">2</span>
              <span className="step-label">Analyze</span>
              <span className="step-text">Stockfish 17.1 evaluates every position</span>
            </div>
            <div className="step-connector" />
            <div className="step-item">
              <span className="step-number">3</span>
              <span className="step-label">Review</span>
              <span className="step-text">Navigate moves, see blunders, and improve</span>
            </div>
          </div>
        </div>

        <div className="feature-grid">
          <div className="feature-card">
            <div className="feature-icon">&#9812;</div>
            <h3>Game Import</h3>
            <p>Seamlessly import games from Chess.com with date filters and batch support</p>
          </div>
          <div className="feature-card">
            <div className="feature-icon">&#9816;</div>
            <h3>Engine Analysis</h3>
            <p>Deep analysis powered by Stockfish 17.1 with configurable depth and MultiPV</p>
          </div>
          <div className="feature-card">
            <div className="feature-icon">&#9814;</div>
            <h3>Accuracy Metrics</h3>
            <p>ACPL-based accuracy scoring for both white and black with letter grades</p>
          </div>
          <div className="feature-card">
            <div className="feature-icon">&#9813;</div>
            <h3>Mistake Detection</h3>
            <p>Classifies every move as blunder, mistake, inaccuracy, good, or excellent</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default App;
