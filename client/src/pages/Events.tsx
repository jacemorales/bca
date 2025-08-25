const events = [
  {
    id: 1,
    title: "Sunday Service",
    day: "SUN",
    date: "Every Sunday",
    time: "10:00 AM",
    location: "Main Sanctuary",
    description: "Join us for worship, prayer, and the Word."
  },
  {
    id: 2,
    title: "Midweek Prayer",
    day: "WED",
    date: "Every Wednesday",
    time: "6:30 PM",
    location: "Prayer Room",
    description: "Corporate prayer and intercession for our church and community."
  },
  {
    id: 3,
    title: "Youth Meetup",
    day: "SAT",
    date: "2nd Saturday each month",
    time: "4:00 PM",
    location: "Youth Center",
    description: "A time for our youth to connect, worship, and grow together."
  }
];

export default function Events() {
  return (
    <div className="page-container">
      <div className="page-header">
        <h1 className="page-title">Church Events</h1>
        <p className="page-subtitle">Find opportunities to gather and grow with us.</p>
      </div>

      <div className="events-list">
        {events.map(event => (
          <div key={event.id} className="card event-card">
            <div className="event-card-date">
              <div className="event-card-day">{event.day}</div>
              <div className="event-card-time">{event.time}</div>
            </div>
            <div className="event-card-details">
              <h3 className="event-card-title">{event.title}</h3>
              <p className="event-card-meta">
                {event.date} • {event.location}
              </p>
              <p className="event-card-description">{event.description}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}