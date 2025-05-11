const mongoose = require('mongoose');

const PDFSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  filename: {
    type: String,
    required: true
  },
  originalName: String,
  path: String,
  size: Number,
  mimeType: {
    type: String,
    default: 'application/pdf'
  },
  content: String,
  uploadTime: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('PDF', PDFSchema);