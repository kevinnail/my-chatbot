import React, { useState } from 'react';
import './FolderSelector.css';

const FolderSelector = ({ onFolderProcess, disabled }) => {
  const [selectedFolder, setSelectedFolder] = useState('');
  const [processing, setProcessing] = useState(false);
  const [status, setStatus] = useState('');

  const handleFolderSelect = (e) => {
    const files = Array.from(e.target.files);
    if (files.length > 0) {
      const folderPath = files[0].webkitRelativePath.split('/')[0];
      setSelectedFolder(folderPath);
      setStatus('');
    }
  };

  const handleProcess = async () => {
    if (!selectedFolder) return;

    setProcessing(true);
    setStatus('Processing folder...');

    try {
      const input = document.querySelector('input[webkitdirectory]');
      const files = Array.from(input.files);

      await onFolderProcess(files);
      setStatus(`✅ Processed ${files.length} files`);
    } catch (error) {
      setStatus('❌ Error processing folder');
      console.error('Folder processing error:', error);
    } finally {
      setProcessing(false);
    }
  };

  return (
    <>
      <input
        type="file"
        webkitdirectory=""
        multiple
        onChange={handleFolderSelect}
        disabled={disabled || processing}
        id="folder-input"
        style={{ display: 'none' }}
      />
      <label htmlFor="folder-input" className="folder-header-button">
        {processing ? '⏳' : '📁'}
      </label>

      {selectedFolder && !processing && (
        <button onClick={handleProcess} disabled={disabled} className="process-header-button">
          ✓
        </button>
      )}
    </>
  );
};

export default FolderSelector;
