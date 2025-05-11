import React, { useEffect, useState } from 'react';
import { FaFileUpload } from 'react-icons/fa';
import './PDFUploader.css';

const PDFUploader = () => {
  const [pdfs, setPdfs] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchPDFs();
  }, []);

  const fetchPDFs = async () => {
    try {
      const response = await fetch('http://localhost:5000/pdfs');
      const data = await response.json();
      setPdfs(data);
    } catch (err) {
      setError('Error fetching PDFs');
    }
  };

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    if (file.type !== 'application/pdf') {
      setError('Please upload a PDF file');
      return;
    }

    setUploading(true);
    setError('');

    const formData = new FormData();
    formData.append('pdf', file);

    try {
      const response = await fetch('http://localhost:5000/upload-pdf', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();
      if (data.success) {
        await fetchPDFs();
      } else {
        setError(data.error || 'Error uploading PDF');
      }
    } catch (err) {
      setError('Error uploading PDF');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="pdf-uploader">
      <div className="upload-section">
        <label className="upload-button">
          <FaFileUpload />
          <span>Upload PDF</span>
          <input
            type="file"
            accept=".pdf"
            onChange={handleFileUpload}
            disabled={uploading}
            style={{ display: 'none' }}
          />
        </label>
        {uploading && <div className="uploading-indicator">Uploading...</div>}
      </div>

      {error && <div className="error-message">{error}</div>}

      <div className="pdf-list">
        <h3>Uploaded PDFs</h3>
        {pdfs.length === 0 ? (
          <p className="no-pdfs">No PDFs uploaded yet</p>
        ) : (
          <ul>
            {pdfs.map((pdf) => (
              <li key={pdf.id} className="pdf-item">
                <span className="pdf-name">{pdf.filename}</span>
                <span className="pdf-date">
                  {new Date(pdf.uploadTime).toLocaleDateString()}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

export default PDFUploader; 