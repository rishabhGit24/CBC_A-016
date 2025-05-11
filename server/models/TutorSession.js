const mongoose = require('mongoose');

const TutorSessionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  subject: {
    type: String,
    required: true
  },
  sessionNumber: Number,
  title: String,
  objectives: [String],
  keyConcepts: [String],
  detailedExplanation: String,
  suggestedNotes: String,
  practiceQuestions: [String],
  relatedPDFs: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'PDF'
  }],
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('TutorSession', TutorSessionSchema);