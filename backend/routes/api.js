const express = require('express');
const router = express.Router();
const jobController = require('../controllers/jobController');
const candidateController = require('../controllers/candidateController');
const campaignController = require('../controllers/campaignController');

// Job endpoints
router.post('/parse-jd', jobController.parseJd);
router.post('/match-candidates', jobController.matchCandidates);

// Candidate endpoints
router.get('/candidates', candidateController.getCandidates);
router.post('/start-chat', candidateController.startChat);
router.post('/simulate-engagement', candidateController.simulateEngagement);

// Campaign endpoints
router.post('/save-campaign', campaignController.saveCampaign);
router.get('/campaigns', campaignController.getCampaigns);
router.get('/campaigns/:id/results', campaignController.getCampaignResults);
router.get('/campaigns/:id/export-excel', campaignController.exportCampaignReport);

module.exports = router;
