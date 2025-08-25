import { Users, Heart, Music, Briefcase } from 'lucide-react';

const ministries = [
  {
    id: 1,
    name: "Children's Ministry",
    description: "Engaging programs for kids ages 3-12 to learn about God in fun, age-appropriate ways.",
    icon: Users,
  },
  {
    id: 2,
    name: "Youth Ministry",
    description: "A place for teens to connect, grow in faith, and build meaningful relationships.",
    icon: Heart,
  },
  {
    id: 3,
    name: "Music & Worship",
    description: "Leading the congregation in worship through music and creative arts.",
    icon: Music,
  },
  {
    id: 4,
    name: "Outreach",
    description: "Serving our community and sharing the love of Christ through practical acts of kindness.",
    icon: Briefcase,
  }
];

export default function Ministries() {
  return (
    <div className="page-container">
      <div className="page-header">
        <h1 className="page-title">Our Ministries</h1>
        <p className="page-subtitle">Find your place to connect, serve, and grow.</p>
      </div>

      <div className="ministries-grid">
        {ministries.map(ministry => {
          const Icon = ministry.icon;
          return (
            <div key={ministry.id} className="card ministry-card">
              <div className="ministry-card-icon-wrapper">
                <Icon size={32} />
              </div>
              <h3 className="ministry-card-title">{ministry.name}</h3>
              <p className="ministry-card-description">{ministry.description}</p>
              <button className="btn btn-secondary">Learn More</button>
            </div>
          );
        })}
      </div>
    </div>
  );
}