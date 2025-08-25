import { Link, useLocation } from "react-router-dom";
import { useState, useEffect } from "react";
import { Sun, Moon, Menu, X } from "lucide-react";

interface NavProps {
  toggleTheme: () => void;
  theme: string;
}

export default function Nav({ toggleTheme, theme }: NavProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const location = useLocation();

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // This effect closes the mobile menu when the route changes
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  const navItems = [
    { path: '/', label: 'Home' },
    { path: '/watch', label: 'Live Stream' },
    { path: '/events', label: 'Events' },
    { path: '/give', label: 'Give' },
    { path: '/about', label: 'About' },
    { path: '/admin', label: 'Admin' }
  ];

  return (
    <header className={`header ${scrolled ? 'scrolled' : ''} ${mobileMenuOpen ? 'mobile-open' : ''}`}>
      <div className="container header-container">
        <Link to="/" className="nav-logo">
          <img src="/logo_transparent.png" alt="BCA Logo" className="nav-logo-img" />
          <span className="nav-logo-text">BCA</span>
        </Link>

        <nav className="nav-main">
          <ul className="nav-links">
            {navItems.map((item) => (
              <li key={item.path}>
                <Link 
                  to={item.path}
                  className={`nav-link ${location.pathname === item.path ? 'active' : ''}`}
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="nav-actions">
          <button onClick={toggleTheme} className="theme-toggle" aria-label="Toggle theme">
            {theme === "light" ? <Moon size={20} /> : <Sun size={20} />}
          </button>
          <button
            className="mobile-menu-toggle"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle mobile menu"
          >
            {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </div>

      {mobileMenuOpen && (
        <div className="mobile-menu">
          <nav>
            <ul>
              {navItems.map((item) => (
                <li key={item.path}>
                  <Link
                    to={item.path}
                    className={`nav-link ${location.pathname === item.path ? 'active' : ''}`}
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      )}
    </header>
  );
}