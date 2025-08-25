import { useState } from 'react';
import { Copy, X } from 'lucide-react';

export default function AccountPopup() {
  const [isOpen, setIsOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const bankDetails = {
    bankName: "UBA",
    accountNumber: "1234567890",
    accountName: "Believers Commonwealth Assembly"
  };

  const copyToClipboard = () => {
    const detailsText = `Bank: ${bankDetails.bankName}\nNumber: ${bankDetails.accountNumber}\nName: ${bankDetails.accountName}`;
    navigator.clipboard.writeText(detailsText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  if (!isOpen) {
    return (
      <button onClick={() => setIsOpen(true)} className="btn btn-secondary">
        Show Bank Details
      </button>
    );
  }

  return (
    <div className="popup-overlay">
      <div className="popup-content">
        <div className="popup-header">
          <h3>Bank Account Details</h3>
          <button className="popup-close" onClick={() => setIsOpen(false)}>
            <X size={24} />
          </button>
        </div>
        <div className="popup-body">
          <div className="bank-details-popup">
            <p>
              <strong>Bank Name:</strong> {bankDetails.bankName}
            </p>
            <p>
              <strong>Account Name:</strong> {bankDetails.accountName}
            </p>
            <p>
              <strong>Account Number:</strong> {bankDetails.accountNumber}
            </p>
          </div>
          <button onClick={copyToClipboard} className={`btn btn-primary ${copied ? 'btn-success' : ''}`}>
            <Copy size={16} />
            {copied ? "Copied!" : "Copy Details"}
          </button>
        </div>
      </div>
    </div>
  );
}