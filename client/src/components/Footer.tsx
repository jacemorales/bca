import { Link } from "react-router-dom";

export default function Footer() {
  return (
    <footer className="footer">
      <div className="container">
        <div className="footer-main">
          <div className="footer-about">
            <Link to="/" className="footer-logo">
              <img src="/logo_transparent.png" alt="BCA Logo" className="footer-logo-img" />
              <span className="footer-logo-text">Believers Commonwealth Assembly</span>
            </Link>
            <p className="footer-about-text">
              A vibrant community of believers, growing in faith and serving with love.
            </p>
          </div>
          <div className="footer-links">
            <h4>Quick Links</h4>
            <ul>
              <li><Link to="/about">About Us</Link></li>
              <li><Link to="/events">Events</Link></li>
              <li><Link to="/sermons">Sermons</Link></li>
              <li><Link to="/give">Give Online</Link></li>
              <li><Link to="/watch">Watch Live</Link></li>
            </ul>
          </div>
          <div className="footer-connect">
            <h4>Connect With Us</h4>
            <p>123 Church Street, Anytown, USA</p>
            <p>contact@bca.org</p>
          </div>
        </div>
        <div className="footer-bottom">
          <p>© {new Date().getFullYear()} Believers Commonwealth Assembly. All Rights Reserved.</p>
        </div>
      </div>
    </footer>
  );
}