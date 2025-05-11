const mongoose = require('mongoose');

const TimelineItemSchema = new mongoose.Schema({
  week: String,
  subject: String,
  description: String,
  resources: [String]
});

const RecommendationSchema = new mongoose.Schema({
  title: String,
  description: String,
  tips: [String]
});

const ModuleDependencySchema = new mongoose.Schema({
  module: String,
  dependsOn: [String]
});

const RoadmapSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  name: String,
  currentGrade: String,
  subjects: [String],
  strengths: [String],
  weaknesses: [String],
  remainingModules: [String],
  progressData: {
    type: Map,
    of: [Number]
  },
  timeline: [TimelineItemSchema],
  recommendations: [RecommendationSchema],
  moduleDependencies: [ModuleDependencySchema],
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Roadmap', RoadmapSchema);