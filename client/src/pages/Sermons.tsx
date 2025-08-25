const pastSermons = [
  {
    id: 1,
    title: "Hope in Action",
    pastor: "Pastor Samuel",
    date: "June 12, 2023",
    scripture: "James 2:14-26",
    description: "Exploring how faith without works is dead and what it means to put our hope into action.",
    videoUrl: "https://youtube.com/embed/example1"
  },
  {
    id: 2,
    title: "The Prodigal Father",
    pastor: "Pastor Michael",
    date: "June 5, 2023",
    scripture: "Luke 15:11-32",
    description: "A fresh look at the parable of the prodigal son from the father's perspective.",
    videoUrl: "https://youtube.com/embed/example2"
  },
  {
    id: 3,
    title: "Rooted in Love",
    pastor: "Pastor Sarah",
    date: "May 29, 2023",
    scripture: "Ephesians 3:14-21",
    description: "Understanding the breadth and depth of Christ's love for us and how to be rooted in it.",
    videoUrl: "https://youtube.com/embed/example3"
  }
];

export default function Sermons() {
  return (
    <div className="page-container">
      <div className="page-header">
        <h1 className="page-title">Sermon Archive</h1>
        <p className="page-subtitle">Catch up on past messages and series.</p>
      </div>

      <div className="sermons-grid">
        {pastSermons.map(sermon => (
          <div key={sermon.id} className="card sermon-archive-card">
            <div className="sermon-video-wrapper">
              <iframe
                src={sermon.videoUrl}
                title={sermon.title}
                className="sermon-video-iframe"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              ></iframe>
            </div>
            <div className="sermon-archive-card-content">
              <h3 className="sermon-archive-card-title">{sermon.title}</h3>
              <p className="sermon-archive-card-meta">
                {sermon.pastor} • {sermon.date}
              </p>
              <p className="sermon-archive-card-scripture">
                {sermon.scripture}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}