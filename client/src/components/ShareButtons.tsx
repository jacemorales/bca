import {
  FacebookShareButton,
  TwitterShareButton,
  WhatsappShareButton,
  FacebookIcon,
  TwitterIcon,
  WhatsappIcon,
} from "react-share";
import { Link2 } from "lucide-react";

interface ShareButtonsProps {
  url: string;
}

export default function ShareButtons({ url }: ShareButtonsProps) {
  const handleCopy = () => {
    navigator.clipboard.writeText(url);
    // Maybe show a toast notification here in a real app
    alert("Link copied to clipboard!");
  };

  return (
    <div className="share-buttons-container">
      <FacebookShareButton url={url} className="share-button">
        <FacebookIcon size={40} round />
      </FacebookShareButton>
      <TwitterShareButton url={url} className="share-button">
        <TwitterIcon size={40} round />
      </TwitterShareButton>
      <WhatsappShareButton url={url} title="Join us for live worship!" separator=" " className="share-button">
        <WhatsappIcon size={40} round />
      </WhatsappShareButton>
      <button 
        onClick={handleCopy}
        className="btn btn-secondary copy-link-btn"
        aria-label="Copy stream link"
      >
        <Link2 size={16} />
        Copy Link
      </button>
    </div>
  );
}