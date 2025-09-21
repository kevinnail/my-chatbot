import React, { useState } from 'react';
import './FolderSelector.css';

const FolderSelector = ({ onFolderProcess, disabled, compact = false }) => {
  const [selectedFolder, setSelectedFolder] = useState('');
  const [processing, setProcessing] = useState(false);
  const [status, setStatus] = useState('');

  const handleFolderSelect = async (e) => {
    if (!e.target.files || e.target.files.length === 0) {
      console.info('No files selected');
      return;
    }

    const files = Array.from(e.target.files);

    if (files.length > 0) {
      const folderPath = files[0].webkitRelativePath.split('/')[0];
      setSelectedFolder(folderPath);
      setStatus('Processing folder...');
      setProcessing(true);

      // Process immediately
      try {
        await onFolderProcess(files);
        setStatus(`✅ Processed ${files.length} files`);
      } catch (error) {
        setStatus('❌ Error processing folder');
        console.error('Folder processing error:', error);
      } finally {
        setProcessing(false);
      }
    }

    // Reset the input to allow re-selection
    e.target.value = '';
  };

  return (
    <>
      {' '}
      <input
        type="file"
        webkitdirectory=""
        multiple
        onChange={handleFolderSelect}
        disabled={disabled || processing || window.isLocal === true}
        id="folder-input"
        style={{ display: 'none' }}
      />
      <label
        style={{ cursor: processing ? 'wait' : 'pointer' }}
        htmlFor="folder-input"
        className={`folder-header-button ${compact ? 'compact' : ''}`}
      >
        {processing ? 'Uploading...⏳' : 'File Upload 📂'}
        {!compact && <span className="folder-text">Upload Files</span>}
      </label>
    </>
  );
};

export default FolderSelector;
