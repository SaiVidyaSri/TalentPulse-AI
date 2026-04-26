const mongoose = require('mongoose');

const CandidateSchema = new mongoose.Schema({
  name: { type: String, required: true },
  skills: [{ type: String }],
  experience: { type: Number },
  location: { type: String },
  availability: { type: String },
  pastRoles: [{ type: String }],
});

module.exports = mongoose.model('Candidate', CandidateSchema);
