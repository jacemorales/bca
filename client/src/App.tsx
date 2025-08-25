import { useState, useEffect, useRef } from "react";
import { Routes, Route, useLocation } from "react-router-dom";
import Nav from "./components/Nav";
import Footer from "./components/Footer";
import Home from "./pages/Home";
import Watch from "./pages/Watch";
import Admin from "./pages/Admin";
import Give from "./pages/Give";
import Events from "./pages/Events";
import About from "./pages/About";
import Ministries from "./pages/Ministries";
import Sermons from "./pages/Sermons";
import { useLoading } from "./contexts/LoadingContext";
import "./App.css";

export default function App() {
  const [theme, setTheme] = useState("light");
  const { isLoading, setIsLoading } = useLoading();
  const location = useLocation();
  const isInitialLoad = useRef(true);

  // Initial load effect
  useEffect(() => {
    // This effect runs only once on mount
    setIsLoading(true);
    const savedTheme = localStorage.getItem("bca:theme") || 
      (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    
    setTheme(savedTheme);
    document.documentElement.setAttribute("data-theme", savedTheme);
    
    const timer = setTimeout(() => {
      setIsLoading(false);
      isInitialLoad.current = false; // Mark initial load as complete
    }, 800);
    return () => clearTimeout(timer);
  }, []);

  // Update theme
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("bca:theme", theme);
    
    const metaThemeColor = document.querySelector('meta[name="theme-color"]');
    if (metaThemeColor) {
      metaThemeColor.setAttribute('content', theme === 'dark' ? '#111827' : '#ffffff');
    }
  }, [theme]);

  // On route change, show loader, scroll to top, then hide loader
  useEffect(() => {
    if (isInitialLoad.current) return; // Don't run on initial load

    setIsLoading(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });

    // Per user feedback, show loader for a fixed time. 1s is a good compromise.
    const timer = setTimeout(() => setIsLoading(false), 1000);

    return () => clearTimeout(timer);
  }, [location.pathname]);

  const toggleTheme = () => {
    setTheme(prevTheme => prevTheme === "light" ? "dark" : "light");
  };

  // Loading screen for initial load and route changes
  if (isLoading) {
    return (
      <div className="loading-screen">
        <img src="/logo_transparent.png" alt="Logo" className="logo" />
        <h2>Believers Commonwealth Assembly</h2>
        <div className="loading-spinner"></div>
      </div>
    );
  }

  return (
    <div className="app-container">
      <Nav toggleTheme={toggleTheme} theme={theme} />
      
      <main className="app-main">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/watch" element={<Watch />} />
          <Route path="/admin" element={<Admin />} />
          <Route path="/give" element={<Give />} />
          <Route path="/events" element={<Events />} />
          <Route path="/about" element={<About />} />
          <Route path="/ministries" element={<Ministries />} />
          <Route path="/sermons" element={<Sermons />} />
        </Routes>
      </main>
      <Footer />
    </div>
  );
}