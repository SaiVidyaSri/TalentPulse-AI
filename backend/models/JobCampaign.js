const mongoose = require('mongoose');

const JobCampaignSchema = new mongoose.Schema({
  title: { type: String, required: true },
  roleTitle: { type: String },
  requiredSkills: [{ type: String }],
  experienceLevel: { type: Number },
  matchedCandidates: [{
    candidate: { type: mongoose.Schema.Types.ObjectId, ref: 'Candidate' },
    matchScore: { type: Number, default: 0 },
    interestScore: { type: Number, default: 0 },
    finalScore: { type: Number, default: 0 },
    explanation: { type: String, default: '' },
    chatHistory: [{
      sender: { type: String },
      text: { type: String },
      timestamp: { type: Date, default: Date.now }
    }],
    status: { type: String, enum: ['Outreach Pending', 'Engaged'], default: 'Outreach Pending' }
  }],
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('JobCampaign', JobCampaignSchema);
