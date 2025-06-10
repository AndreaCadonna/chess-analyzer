import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { useState, useEffect } from "react";
import { healthCheck } from "./services/api";
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
          <h1>Chess Analyzer</h1>
          <div className="health-status">
            {error ? (
              <span className="error">❌ {error}</span>
            ) : health ? (
              <span className="success">✅ System Status: {health.status}</span>
            ) : null}
          </div>
        </header>

        <main>
          <Routes>
            <Route path="/" element={<HomePage />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

const HomePage = () => {
  return (
    <div className="home">
      <h2>Welcome to Chess Analyzer</h2>
      <p>Your personal chess game review platform</p>
      <p>🚧 Under Development - Step 1 Complete! 🚧</p>
    </div>
  );
};

export default App;
