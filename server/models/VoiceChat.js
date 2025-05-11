const mongoose = require('mongoose');

const MessageSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['user', 'assistant'],
    required: true
  },
  content: String,
  audioUrl: String,
  timestamp: {
    type: Date,
    default: Date.now
  }
});

const VoiceChatSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  messages: [MessageSchema],
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('VoiceChat', VoiceChatSchema);