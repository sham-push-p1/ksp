import React, { createContext, useContext, useState, useEffect } from "react";
import { api } from "../utils/api";

const AppContext = createContext();

export function AppProvider({ children }) {
  const [user, setUser] = useState(null);
  const [activeTab, setActiveTab] = useState("dashboard");
  const [theme, setTheme] = useState(() => localStorage.getItem("ksp_theme") || "light");
  const [lastResponse, setLastResponse] = useState(null);
  
  const [dateRange, setDateRange] = useState({
    start: "2019-01-01",
    end: new Date().toISOString().substring(0, 10)
  });

  // Theme logic
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("ksp_theme", theme);
  }, [theme]);

  // Session restore
  useEffect(() => {
    api.getMe().then((res) => {
      if (res.user) {
        setUser(res.user);
      }
    }).catch(() => {});
  }, []);

  const value = {
    user, setUser,
    activeTab, setActiveTab,
    theme, setTheme,
    dateRange, setDateRange,
    lastResponse, setLastResponse
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error("useApp must be used within an AppProvider");
  }
  return context;
}
