
import { useState } from "react";
import ShareButtons from "./ShareButtons";

interface StreamInfo {
  title: string;
  pastor: string;
  scripture: string;
  notes: string;
}

interface SermonInfoProps {
  streamInfo: StreamInfo;
  onUpdate?: (newInfo: StreamInfo) => void;
  isAdmin?: boolean;
}

export default function SermonInfo({ streamInfo, onUpdate, isAdmin = false }: SermonInfoProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [formState, setFormState] = useState(streamInfo);

  const handleSave = () => {
    if (onUpdate) {
      onUpdate(formState);
    }
    setIsEditing(false);
  };

  if (isEditing) {
    return (
      <div className="sermon-info-card is-editing">
        <div className="form-group">
          <label>Title</label>
          <input type="text" value={formState.title} onChange={e => setFormState({...formState, title: e.target.value})} />
        </div>
        <div className="form-group">
          <label>Speaker</label>
          <input type="text" value={formState.pastor} onChange={e => setFormState({...formState, pastor: e.target.value})} />
        </div>
        <div className="form-group">
          <label>Scripture</label>
          <input type="text" value={formState.scripture} onChange={e => setFormState({...formState, scripture: e.target.value})} />
        </div>
        <div className="form-group">
          <label>Notes</label>
          <textarea value={formState.notes} onChange={e => setFormState({...formState, notes: e.target.value})} rows={4}></textarea>
        </div>
        <div className="sermon-info-actions">
          <button className="btn btn-secondary" onClick={() => setIsEditing(false)}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave}>Save Changes</button>
        </div>
      </div>
    );
  }

  return (
    <div className="sermon-info-card">
      <div className="sermon-info-header">
        <h3 className="sermon-title">{streamInfo.title}</h3>
        {isAdmin && <button className="btn-edit" onClick={() => setIsEditing(true)}>✏️ Edit</button>}
      </div>
      <div className="sermon-meta">
        <div className="sermon-pastor"><span>Speaker:</span> {streamInfo.pastor}</div>
        {streamInfo.scripture && <div className="sermon-scripture">📖 {streamInfo.scripture}</div>}
      </div>

      {streamInfo.notes && (
        <div className="sermon-notes">
            <h4>Notes</h4>
            <p>{streamInfo.notes}</p>
        </div>
      )}

      <div className="sermon-info-footer">
        <h4>Share this Stream</h4>
        <ShareButtons url={window.location.href} />
      </div>
    </div>
  );
}
