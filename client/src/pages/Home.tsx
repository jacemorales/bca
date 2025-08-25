import { Link } from 'react-router-dom';
import { PlayCircle, Calendar, Users, HandHeart } from 'lucide-react';

export default function Home() {
  return (
    <div className="home-page">
      <section className="home-hero">
        <div className="home-hero-content">
          <img src="/logo.png" alt="Church Logo" className="home-logo" />
          <h1 className="home-title">
            Welcome to the <br />
            <span>Believers Commonwealth Assembly</span>
          </h1>
          <p className="home-subtitle">
            A place to belong, believe, and become. Join us live every Sunday.
          </p>
          <div className="home-hero-actions">
            <Link to="/watch" className="btn btn-primary btn-icon">
              <PlayCircle size={20} />
              Watch Live
            </Link>
            <Link to="/sermons" className="btn btn-secondary btn-icon">
              <Calendar size={20} />
              View Sermons
            </Link>
          </div>
        </div>
        <div className="home-hero-bg"></div>
      </section>

      <section className="home-section home-about">
        <div className="container">
          <h2 className="home-section-title">A Community of Faith</h2>
          <p className="home-section-description">
            We are a vibrant, multicultural community dedicated to experiencing God's love and sharing it with the world. Whether you're new to faith or a lifelong believer, you have a place here.
          </p>
          <div className="home-features">
            <div className="home-feature-item">
              <Users size={40} className="home-feature-icon" />
              <h3>Worship With Us</h3>
              <p>Experience dynamic worship and inspiring messages every week.</p>
            </div>
            <div className="home-feature-item">
              <HandHeart size={40} className="home-feature-icon" />
              <h3>Grow Together</h3>
              <p>Connect with others through small groups and ministries.</p>
            </div>
            <div className="home-feature-item">
              <PlayCircle size={40} className="home-feature-icon" />
              <h3>Service Times</h3>
              <p>Join us Sundays at 10:00 AM for our weekly worship service.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="home-section home-sermons">
        <div className="container">
            <h2 className="home-section-title">Latest Message</h2>
            <div className="home-latest-sermon">
                {/* This could be dynamically loaded in a real app */}
                <div className="sermon-card-featured">
                    <div className="sermon-card-info">
                        <p className="sermon-card-series">Series: The Book of John</p>
                        <h3 className="sermon-card-title">The True Vine</h3>
                        <p className="sermon-card-speaker">Rev Dr. Eugene-Ndu</p>
                        <p className="sermon-card-description">An in-depth look at Jesus's declaration, "I am the true vine," and what it means for our daily lives.</p>
                        <Link to="/sermons" className="btn btn-secondary">Watch Now</Link>
                    </div>
                </div>
            </div>
        </div>
      </section>
    </div>
  );
}