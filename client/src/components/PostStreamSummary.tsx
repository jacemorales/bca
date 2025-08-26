import { PartyPopper, Users, MessageSquare, Clock } from 'lucide-react';

interface PostStreamSummaryProps {
  stats: {
    duration: string;
    viewerCount: number;
    // chatParticipants: number; // Will add this later
  };
  onClose: () => void;
}

export default function PostStreamSummary({ stats, onClose }: PostStreamSummaryProps) {
  return (
    <div className="post-stream-summary-overlay">
      <div className="post-stream-summary-card card">
        <div className="summary-header">
          <PartyPopper size={48} className="summary-icon" />
          <h2>Stream Ended</h2>
          <p>Here's a summary of your broadcast.</p>
        </div>
        <div className="summary-stats">
          <div className="stat-item">
            <Clock size={24} />
            <div className="stat-value">{stats.duration}</div>
            <div className="stat-label">Duration</div>
          </div>
          <div className="stat-item">
            <Users size={24} />
            <div className="stat-value">{stats.viewerCount}</div>
            <div className="stat-label">Peak Viewers</div>
          </div>
          {/* <div className="stat-item">
            <MessageSquare size={24} />
            <div className="stat-value">{stats.chatParticipants}</div>
            <div className="stat-label">Chatters</div>
          </div> */}
        </div>
        <div className="summary-actions">
          <button onClick={onClose} className="btn btn-primary">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
