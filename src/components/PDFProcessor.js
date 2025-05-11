import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import { CircularProgress, Paper, Typography } from '@mui/material';
import { styled } from '@mui/material/styles';
import React, { useState } from 'react';

const UploadPaper = styled(Paper)(({ theme }) => ({
  padding: theme.spacing(3),
  textAlign: 'center',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: theme.spacing(2),
  backgroundColor: theme.palette.background.default,
  border: `2px dashed ${theme.palette.primary.main}`,
  cursor: 'pointer',
  transition: 'all 0.3s ease',
  '&:hover': {
    backgroundColor: theme.palette.background.paper,
    borderColor: theme.palette.primary.dark,
  },
}));

const HiddenInput = styled('input')({
  display: 'none',
});

const PDFProcessor = ({ onPDFProcessed, onUploadStart }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    if (file.type !== 'application/pdf') {
      setError('Please upload a PDF file');
      return;
    }

    setLoading(true);
    setError('');
    
    // Notify parent component that upload has started
    if (onUploadStart) onUploadStart(file.name);

    const formData = new FormData();
    formData.append('pdf', file);

    try {
      const response = await fetch('http://localhost:5000/api/process-pdf', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Failed to process PDF');
      }

      const data = await response.json();
      onPDFProcessed(data.text);
    } catch (err) {
      setError('Error processing PDF: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <label htmlFor="pdf-upload">
        <HiddenInput
          accept="application/pdf"
          id="pdf-upload"
          type="file"
          onChange={handleFileUpload}
        />
        <UploadPaper elevation={3}>
          {loading ? (
            <CircularProgress />
          ) : (
            <>
              <CloudUploadIcon color="primary" style={{ fontSize: 48 }} />
              <Typography variant="h6" color="primary">
                Upload PDF
              </Typography>
              <Typography variant="body2" color="textSecondary">
                Drag and drop or click to select
              </Typography>
            </>
          )}
        </UploadPaper>
      </label>
      {error && (
        <Typography color="error" variant="body2" style={{ marginTop: 8 }}>
          {error}
        </Typography>
      )}
    </div>
  );
};

export default PDFProcessor;