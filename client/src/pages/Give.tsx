
import { ExternalLink, Copy } from 'lucide-react';
import { useState } from 'react';

export default function Give() {
  const [copied, setCopied] = useState(false);

  const bankDetails = {
    bankName: "UBA",
    accountNumber: "1023007898",
    accountName: "Believers Commonwealth Assembly"
  };

  const copyToClipboard = () => {
    const detailsText = `Bank: ${bankDetails.bankName}\nNumber: ${bankDetails.accountNumber}\nName: ${bankDetails.accountName}`;
    navigator.clipboard.writeText(detailsText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="give-page container">
      <div className="page-header">
        <h1>Support Our Mission</h1>
        <p>Your generosity enables us to continue our work in the community and beyond. Thank you for your faithful giving.</p>
      </div>

      <div className="give-methods">
        <div className="give-card primary-method">
            <h3>Give Online</h3>
            <p>The easiest and most secure way to give. Click below to give a one-time gift or set up recurring donations.</p>
            <a
              href="https://pay-naira.netlify.app/"
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-primary btn-icon"
            >
              Give Securely Online <ExternalLink size={16} />
            </a>
        </div>

        <div className="give-card">
          <h3>Bank Transfer</h3>
          <p>You can also give directly via bank transfer using the details below.</p>
          <div className="bank-details">
            <div className="detail-item">
              <span>Bank Name</span>
              <strong>{bankDetails.bankName}</strong>
            </div>
            <div className="detail-item">
              <span>Account Name</span>
              <strong>{bankDetails.accountName}</strong>
            </div>
            <div className="detail-item">
              <span>Account Number</span>
              <strong>{bankDetails.accountNumber}</strong>
            </div>
          </div>
          <button onClick={copyToClipboard} className="btn btn-secondary btn-icon">
            <Copy size={16} />
            {copied ? "Copied!" : "Copy Details"}
          </button>
        </div>
      </div>
    </div>
  );
}