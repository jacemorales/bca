// SermonDetailsForm.tsx
import React, { useState } from 'react';

interface StreamInfo {
  title: string;
  pastor: string;
  scripture: string;
  notes: string;
}

interface SermonDetailsFormProps {
  initialInfo: StreamInfo;
  onSubmit: (info: StreamInfo) => void;
  onCancel: () => void;
  isStreaming: boolean;
}

export default function SermonDetailsForm({ initialInfo, onSubmit, onCancel, isStreaming }: SermonDetailsFormProps) {
  const [streamInfo, setStreamInfo] = useState<StreamInfo>(initialInfo);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setStreamInfo(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(streamInfo);
  };

  return (
    <div className="popup-overlay">
      <div className="popup-content">
        <form onSubmit={handleSubmit}>
          <div className="popup-header">
            <h3>{isStreaming ? "Edit Stream Details" : "Setup Live Stream"}</h3>
            <button type="button" className="popup-close" onClick={onCancel}>×</button>
          </div>
          <div className="popup-body">
            <div className="form-group">
              <label htmlFor="title">Sermon Title</label>
              <input
                id="title"
                name="title"
                type="text"
                value={streamInfo.title}
                onChange={handleChange}
                placeholder="e.g., The Good Shepherd"
                required
              />
            </div>
            <div className="form-group">
              <label htmlFor="pastor">Speaker</label>
              <input
                id="pastor"
                name="pastor"
                type="text"
                value={streamInfo.pastor}
                onChange={handleChange}
                placeholder="e.g., Rev. Dr. Eugene-Ndu"
                required
              />
            </div>
            <div className="form-group">
              <label htmlFor="scripture">Scripture Reference</label>
              <input
                id="scripture"
                name="scripture"
                type="text"
                value={streamInfo.scripture}
                onChange={handleChange}
                placeholder="e.g., John 10:11-18"
              />
            </div>
            <div className="form-group">
              <label htmlFor="notes">Notes (Optional)</label>
              <textarea
                id="notes"
                name="notes"
                value={streamInfo.notes}
                onChange={handleChange}
                placeholder="Add key points, announcements, or other notes..."
                rows={4}
              />
            </div>
          </div>
          <div className="popup-footer">
            <button type="button" className="btn btn-secondary" onClick={onCancel}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary">
              {isStreaming ? "Update Details" : "Confirm Details"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
