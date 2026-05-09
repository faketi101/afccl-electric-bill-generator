import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import CustomerTab from "./tabs/CustomerTab";
import ConfigTab from "./tabs/ConfigTab";
import GenerateTab from "./tabs/GenerateTab";
import AnalyzerTab from "./tabs/AnalyzerTab";
import SettingsTab from "./tabs/SettingsTab";

const TABS = [
  { id: "generate", label: "📄 Generate Bill" },
  { id: "analyzer", label: "📊 Bill Analyzer" },
  { id: "customers", label: "👥 Customers" },
  { id: "config", label: "⚙️ Config" },
  { id: "settings", label: "🎨 Invoice Settings" },
];

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState("generate");
  const { username, logout } = useAuth();

  const renderTab = () => {
    switch (activeTab) {
      case "customers":
        return <CustomerTab />;
      case "config":
        return <ConfigTab />;
      case "generate":
        return <GenerateTab />;
      case "analyzer":
        return <AnalyzerTab />;
      case "settings":
        return <SettingsTab />;
    }
  };

  return (
    <div className="dashboard-shell">
      <header className="header">
        <span className="header-logo">⚡ Electric Bill System</span>
        <div className="header-right">
          <span className="header-user">👤 {username}</span>
          <button onClick={logout} className="logout-btn">
            Logout
          </button>
        </div>
      </header>

      <nav className="nav">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`nav-btn ${activeTab === tab.id ? "nav-btn-active" : ""}`}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      <main className="main">{renderTab()}</main>
    </div>
  );
}
