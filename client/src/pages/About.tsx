export default function About() {
  const values = [
    "Biblical Truth",
    "Authentic Worship",
    "Intentional Discipleship",
    "Genuine Community",
    "Compassionate Service",
    "Generous Living",
  ];

  return (
    <div className="page-container">
      <div className="page-header">
        <h1 className="page-title">About Us</h1>
        <p className="page-subtitle">Our story, our vision, and what we believe.</p>
      </div>

      <div className="card-grid">
        <div className="card">
          <h3 className="card-title">Our Story</h3>
          <p>
            Founded in 2010, Believers Commonwealth Assembly began as a small gathering of believers in a living room.
            Today, we're a thriving community committed to making disciples and serving our city.
          </p>
        </div>
        <div className="card">
          <h3 className="card-title">Our Vision</h3>
          <p>
            To be a church that transforms lives through the power of the Gospel,
            builds authentic community, and serves our city with the love of Christ.
          </p>
        </div>
      </div>

      <div className="card values-card">
        <h3 className="card-title">Our Core Values</h3>
        <ul className="values-list">
          {values.map((value) => (
            <li key={value}>{value}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}