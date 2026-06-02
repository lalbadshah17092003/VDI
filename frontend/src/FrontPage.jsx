import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { 
  FaYoutube, FaInstagram, FaVideo, FaDownload, FaSpinner, 
  FaMusic, FaLink, FaCheckCircle, FaExclamationTriangle,
  FaClock, FaUser, FaEye, FaFilm, FaTimes, FaArrowRight,
  FaHistory, FaTrash, FaCopy
} from 'react-icons/fa';
import './FrontPage.css';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

function Front_Page() {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [videoInfo, setVideoInfo] = useState(null);
  const [error, setError] = useState('');
  const [selectedFormat, setSelectedFormat] = useState('');
  const [activeTab, setActiveTab] = useState('download');
  const [history, setHistory] = useState([]);
  const [toast, setToast] = useState(null);
  const urlInputRef = useRef(null);

  // Load history from localStorage
  useEffect(() => {
    const savedHistory = localStorage.getItem('downloadHistory');
    if (savedHistory) {
      setHistory(JSON.parse(savedHistory));
    }
    // Focus input on load
    urlInputRef.current?.focus();
  }, []);

  // Show toast message
  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  // Add to history
  const addToHistory = (info) => {
    const newHistory = [{
      id: Date.now(),
      title: info.title,
      thumbnail: info.thumbnail,
      platform: info.platform,
      url: url,
      downloadedAt: new Date().toISOString(),
      format: selectedFormat || 'best'
    }, ...history.slice(0, 19)]; // Keep last 20
    
    setHistory(newHistory);
    localStorage.setItem('downloadHistory', JSON.stringify(newHistory));
  };

  // Clear history
  const clearHistory = () => {
    setHistory([]);
    localStorage.removeItem('downloadHistory');
    showToast('History cleared', 'info');
  };

  // Copy to clipboard
  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    showToast('URL copied to clipboard!');
  };

  const getPlatformIcon = (platform) => {
    switch(platform) {
      case 'youtube': return <FaYoutube />;
      case 'instagram': return <FaInstagram />;
      default: return <FaVideo />;
    }
  };

  const getPlatformColor = (platform) => {
    switch(platform) {
      case 'youtube': return '#ff0000';
      case 'instagram': return '#e4405f';
      case 'tiktok': return '#000000';
      case 'twitter': return '#1da1f2';
      case 'facebook': return '#1877f2';
      default: return '#6c5ce7';
    }
  };

  const getPlatformName = (platform) => {
    switch(platform) {
      case 'youtube': return 'YouTube';
      case 'instagram': return 'Instagram';
      case 'tiktok': return 'TikTok';
      case 'twitter': return 'Twitter';
      case 'facebook': return 'Facebook';
      default: return 'Direct URL';
    }
  };

  const handleFetchInfo = async (e) => {
    e.preventDefault();
    
    if (!url) {
      setError('Please enter a URL');
      urlInputRef.current?.focus();
      return;
    }

    // Basic URL validation
    try {
      new URL(url);
    } catch {
      setError('Please enter a valid URL');
      return;
    }

    setLoading(true);
    setError('');
    setVideoInfo(null);
    setSelectedFormat('');

    try {
      const response = await axios.post(`${API_URL}/video-info`, { url });
      
      if (response.data.success) {
        setVideoInfo(response.data);
        
        // Auto-select best format
        if (response.data.formats && response.data.formats.length > 0) {
          // Prefer format with both video and audio
          const bestFormat = response.data.formats.find(f => 
            f.vcodec !== 'none' && f.acodec !== 'none'
          ) || response.data.formats[0];
          
          if (bestFormat) {
            setSelectedFormat(bestFormat.format_id || bestFormat.itag);
          }
        }
        
        showToast('Video found! Select quality and download.');
      } else {
        setError(response.data.error || 'Failed to fetch video info');
      }
    } catch (err) {
      if (err.code === 'ERR_NETWORK') {
        setError('Cannot connect to server. Make sure backend is running on port 5000.');
      } else {
        setError(err.response?.data?.error || 'Failed to fetch video info. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async (downloadFormat = 'video') => {
    if (!videoInfo) {
      setError('Please fetch video info first');
      return;
    }

    setDownloading(true);
    setError('');

    try {
      const payload = {
        url: url,
        format_id: downloadFormat === 'audio' ? 'audio' : (selectedFormat || 'best')
      };

      const response = await axios.post(`${API_URL}/download`, payload, {
        responseType: 'blob',
        timeout: 600000, // 10 minutes
        onDownloadProgress: (progressEvent) => {
          // You can add progress bar here if needed
        }
      });

      // Get filename from headers or generate one
      const contentDisposition = response.headers['content-disposition'];
      let filename = `video_${Date.now()}.mp4`;
      
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
        if (filenameMatch && filenameMatch[1]) {
          filename = filenameMatch[1].replace(/['"]/g, '');
        }
      }

      // Create and trigger download
      const blob = new Blob([response.data]);
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);

      // Add to history
      addToHistory(videoInfo);
      showToast('Download started successfully! 🎉');

    } catch (err) {
      console.error('Download error:', err);
      setError('Download failed. Please try again or select a different format.');
    } finally {
      setDownloading(false);
    }
  };

  const handleClearUrl = () => {
    setUrl('');
    setVideoInfo(null);
    setError('');
    setSelectedFormat('');
    urlInputRef.current?.focus();
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now - date;
    
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return date.toLocaleDateString();
  };

  // Determine toast class based on type
  const getToastClass = () => {
    switch(toast?.type) {
      case 'success': return 'toast-success';
      case 'error': return 'toast-error';
      case 'info': return 'toast-info';
      default: return 'toast-success';
    }
  };

  return (
    <div className="app-container">
      {/* Toast Notification */}
      {toast && (
        <div className={`toast ${getToastClass()}`}>
          <div className="toast-icon">
            {toast.type === 'success' ? <FaCheckCircle /> : 
             toast.type === 'error' ? <FaExclamationTriangle /> : 
             <FaCheckCircle />}
          </div>
          <span className="toast-message">{toast.message}</span>
          <button 
            className="toast-close"
            onClick={() => setToast(null)}
          >
            <FaTimes />
          </button>
        </div>
      )}

      <div className="main-container">
        {/* Header */}
        <div className="header-section">
          <div className="logo-wrapper">
            <FaDownload className="logo-icon" />
            <h1 className="main-title">
              Video<span className="title-span">Downloader</span>
            </h1>
          </div>
          <p className="subtitle-text">
            Download videos from YouTube, Instagram, TikTok & more
          </p>
        </div>

        {/* Tabs */}
        <div className="tabs-container">
          <button 
            className={`tab-button ${activeTab === 'download' ? 'tab-button-active' : ''}`}
            onClick={() => setActiveTab('download')}
          >
            <FaDownload className="tab-icon" /> 
            <span className="tab-label">Download</span>
          </button>
          <button 
            className={`tab-button ${activeTab === 'history' ? 'tab-button-active' : ''}`}
            onClick={() => setActiveTab('history')}
          >
            <FaHistory className="tab-icon" /> 
            <span className="tab-label">History</span>
            {history.length > 0 && <span className="badge-number">{history.length}</span>}
          </button>
        </div>

        {activeTab === 'download' ? (
          <>
            {/* URL Input Section */}
            <div className="input-section-wrapper">
              <form onSubmit={handleFetchInfo} className="url-input-form">
                <div className="input-wrapper-group">
                  <div className="input-icon-box">
                    <FaLink className="input-icon" />
                  </div>
                  <input
                    ref={urlInputRef}
                    type="text"
                    placeholder="Paste your video URL here... (YouTube, Instagram, TikTok, etc.)"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    className="url-text-field"
                    disabled={loading}
                    onKeyDown={(e) => e.key === 'Enter' && handleFetchInfo(e)}
                  />
                  {url && (
                    <button 
                      type="button" 
                      className="clear-url-button"
                      onClick={handleClearUrl}
                    >
                      <FaTimes className="clear-icon" />
                    </button>
                  )}
                  <button 
                    type="submit" 
                    className="fetch-button"
                    disabled={loading || !url}
                  >
                    {loading ? (
                      <>
                        <FaSpinner className="spinner-icon" /> 
                        <span className="button-text">Analyzing...</span>
                      </>
                    ) : (
                      <>
                        <FaArrowRight className="button-icon" /> 
                        <span className="button-text">Get Video</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
              
              {/* Quick Platform Pills */}
              <div className="platform-pills-container">
                <span className="pill-label-text">Supports:</span>
                <span className="pill-item pill-youtube">
                  <FaYoutube className="pill-icon" /> YouTube
                </span>
                <span className="pill-item pill-instagram">
                  <FaInstagram className="pill-icon" /> Instagram
                </span>
                <span className="pill-item pill-tiktok">
                  <FaVideo className="pill-icon" /> TikTok
                </span>
                <span className="pill-item pill-direct">
                  <FaVideo className="pill-icon" /> Direct URL
                </span>
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <div className="error-card-container">
                <FaExclamationTriangle className="error-icon" />
                <div className="error-content-box">
                  <p className="error-message">{error}</p>
                  <button 
                    className="error-dismiss-button"
                    onClick={() => setError('')}
                  >
                    <FaTimes className="error-dismiss-icon" />
                  </button>
                </div>
              </div>
            )}

            {/* Loading Skeleton */}
            {loading && (
              <div className="skeleton-card-wrapper">
                <div className="skeleton-thumbnail"></div>
                <div className="skeleton-content">
                  <div className="skeleton-line skeleton-title"></div>
                  <div className="skeleton-line skeleton-meta"></div>
                  <div className="skeleton-line skeleton-short"></div>
                </div>
              </div>
            )}

            {/* Video Info Card */}
            {videoInfo && !loading && (
              <div className="video-card-wrapper">
                {/* Thumbnail & Basic Info */}
                <div className="video-hero-section">
                  {videoInfo.thumbnail && (
                    <div className="thumbnail-container">
                      <img 
                        src={videoInfo.thumbnail} 
                        alt={videoInfo.title} 
                        className="thumbnail-image"
                        onError={(e) => {
                          e.target.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" fill="%23ddd"><rect width="100%" height="100%"/><text x="50%" y="50%" text-anchor="middle" dy=".3em" font-size="20">No Thumbnail</text></svg>';
                        }}
                      />
                      {videoInfo.durationSeconds > 0 && (
                        <span className="duration-badge">
                          <FaClock className="duration-icon" /> {videoInfo.duration}
                        </span>
                      )}
                      <div className="play-overlay">
                        <span className="play-icon">▶</span>
                      </div>
                    </div>
                  )}
                  
                  <div className="video-meta-info">
                    <span 
                      className="platform-badge"
                      style={{ backgroundColor: getPlatformColor(videoInfo.platform) }}
                    >
                      {getPlatformIcon(videoInfo.platform)}
                      {getPlatformName(videoInfo.platform)}
                    </span>
                    
                    <h2 className="video-title">{videoInfo.title}</h2>
                    
                    <div className="meta-tags-wrapper">
                      {videoInfo.author && (
                        <span className="meta-tag-item">
                          <FaUser className="meta-icon" /> {videoInfo.author}
                        </span>
                      )}
                      {videoInfo.duration && (
                        <span className="meta-tag-item">
                          <FaClock className="meta-icon" /> {videoInfo.duration}
                        </span>
                      )}
                      {videoInfo.views > 0 && (
                        <span className="meta-tag-item">
                          <FaEye className="meta-icon" /> {parseInt(videoInfo.views).toLocaleString()} views
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Format Selection */}
                {videoInfo.formats && videoInfo.formats.length > 0 && (
                  <div className="formats-section">
                    <h3 className="section-title">
                      <FaFilm className="section-icon" /> Select Quality & Format
                    </h3>
                    <div className="format-grid">
                      {videoInfo.formats.slice(0, 12).map((format, index) => {
                        const formatId = format.format_id || format.itag;
                        const isSelected = selectedFormat === formatId;
                        
                        return (
                          <div
                            key={index}
                            className={`format-card ${isSelected ? 'format-card-selected' : ''}`}
                            onClick={() => setSelectedFormat(formatId)}
                          >
                            <div className="format-header">
                              <span className="format-quality">
                                {format.quality || format.resolution || 'Unknown'}
                              </span>
                              {isSelected && <FaCheckCircle className="check-icon" />}
                            </div>
                            <div className="format-details">
                              <span className="format-type">
                                .{format.ext || format.container || 'mp4'}
                              </span>
                              <span className="format-size">
                                {format.filesize || format.contentLength || '~Unknown'}
                              </span>
                            </div>
                            <div className="format-codecs">
                              {format.vcodec !== 'none' && (
                                <span className="codec-badge codec-video">
                                  🎬 Video
                                </span>
                              )}
                              {format.acodec !== 'none' && (
                                <span className="codec-badge codec-audio">
                                  🎵 Audio
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Download Buttons */}
                <div className="action-buttons">
                  <button
                    onClick={() => handleDownload('video')}
                    className="btn btn-primary"
                    disabled={downloading}
                  >
                    {downloading ? (
                      <>
                        <FaSpinner className="spinner-icon" /> 
                        <span className="button-text">Downloading...</span>
                      </>
                    ) : (
                      <>
                        <FaDownload className="button-icon" /> 
                        <span className="button-text">Download Video</span>
                      </>
                    )}
                  </button>
                  
                  {videoInfo.platform === 'youtube' && (
                    <button
                      onClick={() => handleDownload('audio')}
                      className="btn btn-secondary"
                      disabled={downloading}
                    >
                      <FaMusic className="button-icon" /> 
                      <span className="button-text">Download Audio (MP3)</span>
                    </button>
                  )}
                  
                  <button
                    onClick={() => copyToClipboard(url)}
                    className="btn btn-ghost"
                  >
                    <FaCopy className="button-icon" /> 
                    <span className="button-text">Copy Link</span>
                  </button>
                </div>
              </div>
            )}
          </>
        ) : (
          /* History Tab */
          <div className="history-section">
            {history.length > 0 ? (
              <>
                <div className="history-header">
                  <h3 className="history-title">Download History</h3>
                  <button 
                    className="btn-clear-history"
                    onClick={clearHistory}
                  >
                    <FaTrash className="clear-history-icon" /> 
                    <span className="button-text">Clear All</span>
                  </button>
                </div>
                <div className="history-list">
                  {history.map((item) => (
                    <div key={item.id} className="history-item">
                      <div className="history-thumbnail">
                        {item.thumbnail ? (
                          <img 
                            src={item.thumbnail} 
                            alt={item.title}
                            className="history-thumbnail-image"
                          />
                        ) : (
                          <div className="no-thumb-placeholder">
                            <FaVideo className="placeholder-icon" />
                          </div>
                        )}
                      </div>
                      <div className="history-info">
                        <p className="history-title-text">{item.title}</p>
                        <div className="history-meta">
                          <span 
                            className="platform-badge-small"
                            style={{ backgroundColor: getPlatformColor(item.platform) }}
                          >
                            {getPlatformName(item.platform)}
                          </span>
                          <span className="history-date">
                            {formatDate(item.downloadedAt)}
                          </span>
                        </div>
                      </div>
                      <button 
                        className="redownload-button"
                        onClick={() => {
                          setUrl(item.url);
                          setActiveTab('download');
                          urlInputRef.current?.focus();
                        }}
                      >
                        <FaDownload className="redownload-icon" />
                      </button>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="empty-state">
                <FaHistory className="empty-icon" />
                <h3 className="empty-title">No downloads yet</h3>
                <p className="empty-description">
                  Your downloaded videos will appear here
                </p>
                <button 
                  onClick={() => setActiveTab('download')}
                  className="btn btn-primary"
                >
                  <span className="button-text">Start Downloading</span>
                </button>
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="footer">
          <p className="footer-text">
            ⚠️ Please ensure you have the right to download content. Respect copyright laws.
          </p>
        </div>
      </div>
    </div>
  );
}

export default Front_Page;