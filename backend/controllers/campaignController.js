const JobCampaign = require('../models/JobCampaign');
const ExcelJS = require('exceljs');
const { summarizeInterestTone, inferInitialInterest, buildInitialAutoConversation, getSkillCoverage } = require('../utils/interestScorer');

// Use shared interest scoring and conversation logic from utils

const buildAiSummary = ({ campaign, candidate, matchEntry }) => {
  const candidateSkills = Array.isArray(candidate.skills) ? candidate.skills : [];
  const requiredSkills = Array.isArray(campaign.requiredSkills) ? campaign.requiredSkills : [];
  const overlap = candidateSkills.filter((skill) =>
    requiredSkills.some(
      (requiredSkill) =>
        String(requiredSkill).toLowerCase().includes(String(skill).toLowerCase()) ||
        String(skill).toLowerCase().includes(String(requiredSkill).toLowerCase())
    )
  );

  const overlapText = overlap.length
    ? `${overlap.length}/${requiredSkills.length || overlap.length} core skills align (${overlap.slice(0, 5).join(', ')}${overlap.length > 5 ? ', ...' : ''}).`
    : 'Skill overlap is limited, but there may be transferable strengths.';

  const expRequired = Number(campaign.experienceLevel || 0);
  const expActual = Number(candidate.experience || 0);
  const experienceText = expActual >= expRequired
    ? `Experience is on target (${expActual} years vs ${expRequired} years required).`
    : `Experience is slightly below target (${expActual} years vs ${expRequired} required), so coaching runway should be considered.`;

  const roleContext = Array.isArray(candidate.pastRoles) && candidate.pastRoles.length
    ? `Background includes roles such as ${candidate.pastRoles.slice(0, 2).join(' and ')}.`
    : 'Role history is limited in the profile data.';

  const { tone, highlights } = summarizeInterestTone(matchEntry.chatHistory || []);
  const chatTurns = Array.isArray(matchEntry.chatHistory) ? matchEntry.chatHistory.length : 0;
  const chatText = chatTurns > 0
    ? `Conversation depth: ${chatTurns} messages exchanged with a ${tone} engagement tone.`
    : 'No live engagement yet; recommendation is based on profile and match signals only.';

  const recommendation = matchEntry.status === 'Engaged'
    ? (matchEntry.interestScore >= 75
      ? 'Recommendation: move to recruiter screening quickly while momentum is high.'
      : 'Recommendation: continue follow-up with clarifying role scope, growth path, and logistics before final decision.')
    : 'Recommendation: initiate outreach to validate intent, notice period, and compensation fit.';

  const excerptText = highlights.length
    ? `Recent candidate signal: "${highlights[0]}${highlights[0].endsWith('.') ? '' : '...'}"`
    : '';

  return [
    `Overall fit: ${matchEntry.finalScore || matchEntry.matchScore}/100 (match ${matchEntry.matchScore || 0}, interest ${matchEntry.interestScore || 0}).`,
    overlapText,
    experienceText,
    roleContext,
    chatText,
    excerptText,
    recommendation
  ].filter(Boolean).join(' ');
};

const buildRecommendation = (matchEntry) => {
  if (matchEntry.status === 'Engaged') {
    return matchEntry.interestScore >= 75
      ? 'Move to recruiter screening quickly while momentum is high.'
      : 'Continue follow-up with role scope, growth path, and logistics before final decision.';
  }

  return 'Initiate outreach to validate intent, notice period, and compensation fit.';
};



const backfillAutoChatForCampaign = async (campaign) => {
  if (!campaign || !Array.isArray(campaign.matchedCandidates)) return false;
  let changed = false;

  for (const mc of campaign.matchedCandidates) {
    const candidate = mc?.candidate;
    if (!candidate) continue;

    const hasChat = Array.isArray(mc.chatHistory) && mc.chatHistory.length >= 8;
    const hasScore = typeof mc.interestScore === 'number' && mc.interestScore > 0;

    // Only generate chat if missing or too short
    if (!hasChat) {
      const candidateObj = typeof candidate.toObject === 'function' ? candidate.toObject() : candidate;
      const { matched } = getSkillCoverage(campaign.requiredSkills, candidateObj.skills || []);
      mc.chatHistory = buildInitialAutoConversation({
        candidate: candidateObj,
        roleTitle: campaign.roleTitle,
        matchedSkills: matched,
        matchScore: mc.matchScore
      });
      mc.status = 'Engaged';
      changed = true;
    }

    // Always ensure interest score is calculated if missing or 0 or if chat was just updated
    if (!hasScore || !hasChat) {
      const { interestScore: calculatedScore } = summarizeInterestTone(mc.chatHistory || []);
      
      let finalInterest = calculatedScore;
      // If interestScore is 0 or 72 (default for empty/neutral), try to infer it for better realism
      if (!finalInterest || finalInterest === 0 || finalInterest === 72) {
        const candidateObj = typeof candidate.toObject === 'function' ? candidate.toObject() : candidate;
        finalInterest = inferInitialInterest({
          matchScore: mc.matchScore,
          experience: candidateObj.experience,
          experienceLevel: campaign.experienceLevel,
          candidateName: candidateObj.name
        });
      }

      // Explicitly set the properties on the subdocument
      mc.interestScore = finalInterest || 70;
      mc.finalScore = Math.round((Number(mc.matchScore || 0) * 0.6) + (Number(mc.interestScore) * 0.4));
      changed = true;
    }
  }

  if (changed) {
    campaign.markModified('matchedCandidates');
    await campaign.save();
  }

  return changed;
};

const mapRankedCandidates = (campaign) => {
  if (!campaign || !Array.isArray(campaign.matchedCandidates)) return [];

  return campaign.matchedCandidates
    .filter(mc => mc && mc.candidate)
    .map((mc) => {
      // Ensure we have a plain object for the candidate
      const candidateProfile = typeof mc.candidate.toObject === 'function' 
        ? mc.candidate.toObject() 
        : mc.candidate;
      
      const aiSummary = buildAiSummary({ campaign, candidate: candidateProfile, matchEntry: mc });
      
      // Ensure interestScore is at least something if it's 0 or the default baseline
      let interestScore = mc.interestScore || 0;
      if (interestScore === 0 || interestScore === 72) {
        const { interestScore: summarized } = summarizeInterestTone(mc.chatHistory || []);
        interestScore = (summarized && summarized !== 72) ? summarized : inferInitialInterest({
          matchScore: mc.matchScore,
          experience: candidateProfile.experience,
          experienceLevel: campaign.experienceLevel,
          candidateName: candidateProfile.name
        });
      }

      const finalScore = mc.finalScore || Math.round((Number(mc.matchScore || 0) * 0.6) + (interestScore * 0.4));

      return {
        ...candidateProfile,
        matchScore: mc.matchScore,
        interestScore: interestScore,
        finalScore: finalScore,
        explanation: mc.explanation || '',
        status: mc.status || 'Outreach Pending',
        chatHistory: mc.chatHistory || [],
        aiSummary,
        recommendation: buildRecommendation(mc)
      };
    })
    .sort((a, b) => (b.finalScore || 0) - (a.finalScore || 0));
};

exports.saveCampaign = async (req, res) => {
  try {
    const { title, roleTitle, requiredSkills, experienceLevel, shortlistedCandidates } = req.body;
    
    if (!title || !shortlistedCandidates) {
      return res.status(400).json({ error: 'Title and candidates are required' });
    }

    const campaign = new JobCampaign({
      title,
      roleTitle,
      requiredSkills,
      experienceLevel,
      shortlistedCandidates
    });

    await campaign.save();
    res.status(201).json(campaign);
  } catch (error) {
    console.error('Error saving campaign:', error);
    res.status(500).json({ error: 'Failed to save campaign' });
  }
};

exports.getCampaigns = async (req, res) => {
  try {
    const campaigns = await JobCampaign.find().populate('matchedCandidates.candidate').sort({ createdAt: -1 });
    res.json(campaigns);
  } catch (error) {
    console.error('Error fetching campaigns:', error);
    res.status(500).json({ error: 'Failed to fetch campaigns' });
  }
};

exports.getCampaignResults = async (req, res) => {
  try {
    const { id } = req.params;
    let campaign;
    
    const populateQuery = {
      path: 'matchedCandidates.candidate',
      model: 'Candidate'
    };

    if (id === 'latest' || !id) {
      campaign = await JobCampaign.findOne().sort({ createdAt: -1 }).populate(populateQuery);
    } else {
      campaign = await JobCampaign.findById(id).populate(populateQuery);
    }

    if (!campaign) return res.json({ campaignDetails: null, candidates: [] });

    // Perform backfill and check if anything changed
    const wasChanged = await backfillAutoChatForCampaign(campaign);
    
    // If changes were saved, we might want to use the updated document
    // but Mongoose updates the in-memory object anyway.
    
    const ranked = mapRankedCandidates(campaign);

    res.json({ 
      campaignDetails: campaign, 
      candidates: ranked, 
      campaignId: campaign._id 
    });
  } catch (error) {
    console.error('Error fetching campaign results:', error);
    res.status(500).json({ error: 'Failed to fetch campaign results' });
  }
};

exports.exportCampaignReport = async (req, res) => {
  try {
    const { id } = req.params;
    const { scope = 'engaged', top } = req.query;

    let campaign;
    if (id === 'latest' || !id) {
      campaign = await JobCampaign.findOne().sort({ createdAt: -1 }).populate('matchedCandidates.candidate');
    } else {
      campaign = await JobCampaign.findById(id).populate('matchedCandidates.candidate');
    }

    if (!campaign) {
      return res.status(404).json({ error: 'Campaign not found' });
    }

    let rankedCandidates = mapRankedCandidates(campaign);
    if (scope === 'engaged') rankedCandidates = rankedCandidates.filter((c) => c.status === 'Engaged');
    if (scope === 'pending') rankedCandidates = rankedCandidates.filter((c) => c.status === 'Outreach Pending');

    const topNumber = Number(top);
    if (Number.isFinite(topNumber) && topNumber > 0) {
      rankedCandidates = rankedCandidates.slice(0, topNumber);
    }

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'TalentPulseAI';
    workbook.created = new Date();

    const summarySheet = workbook.addWorksheet('Campaign Summary');
    summarySheet.columns = [
      { header: 'Field', key: 'field', width: 28 },
      { header: 'Value', key: 'value', width: 80 }
    ];

    summarySheet.addRows([
      { field: 'Campaign Title', value: campaign.title || '' },
      { field: 'Role Title', value: campaign.roleTitle || '' },
      { field: 'Required Experience', value: `${campaign.experienceLevel || 0} years` },
      { field: 'Required Skills', value: (campaign.requiredSkills || []).join(', ') },
      { field: 'Total Ranked Candidates', value: mapRankedCandidates(campaign).length },
      { field: 'Export Scope', value: scope },
      { field: 'Top Limit', value: Number.isFinite(topNumber) && topNumber > 0 ? topNumber : 'Not Applied' },
      { field: 'Exported Candidates', value: rankedCandidates.length },
      { field: 'Generated At', value: new Date().toISOString() }
    ]);

    const detailSheet = workbook.addWorksheet('Ranked Candidates');
    detailSheet.columns = [
      { header: 'Rank', key: 'rank', width: 8 },
      { header: 'Candidate Name', key: 'name', width: 24 },
      { header: 'Status', key: 'status', width: 18 },
      { header: 'Location', key: 'location', width: 20 },
      { header: 'Availability', key: 'availability', width: 20 },
      { header: 'Experience (Years)', key: 'experience', width: 16 },
      { header: 'Required Skills', key: 'requiredSkills', width: 38 },
      { header: 'Present Skills', key: 'presentSkills', width: 38 },
      { header: 'Matched Required Skills', key: 'matchedSkills', width: 38 },
      { header: 'Missing Required Skills', key: 'missingSkills', width: 38 },
      { header: 'Match Score', key: 'matchScore', width: 14 },
      { header: 'Interest Score', key: 'interestScore', width: 14 },
      { header: 'Final Score', key: 'finalScore', width: 12 },
      { header: 'Explanation', key: 'explanation', width: 60 },
      { header: 'Recommendation', key: 'recommendation', width: 64 },
      { header: 'AI Summary', key: 'aiSummary', width: 90 },
      { header: 'Latest Candidate Message', key: 'latestCandidateMessage', width: 70 },
      { header: 'Past Roles', key: 'pastRoles', width: 38 }
    ];

    rankedCandidates.forEach((candidate, index) => {
      const { matched, missing } = getSkillCoverage(campaign.requiredSkills, candidate.skills);
      const latestCandidateMessage = (candidate.chatHistory || [])
        .filter((msg) => msg.sender && msg.sender !== 'AI Recruiter' && msg.sender !== 'Human Recruiter' && msg.sender !== 'System')
        .slice(-1)[0]?.text || '';

      detailSheet.addRow({
        rank: index + 1,
        name: candidate.name || '',
        status: candidate.status || '',
        location: candidate.location || '',
        availability: candidate.availability || '',
        experience: candidate.experience || 0,
        requiredSkills: (campaign.requiredSkills || []).join(', '),
        presentSkills: (candidate.skills || []).join(', '),
        matchedSkills: matched.join(', '),
        missingSkills: missing.join(', '),
        matchScore: candidate.matchScore || 0,
        interestScore: candidate.interestScore || 0,
        finalScore: candidate.finalScore || 0,
        explanation: candidate.explanation || '',
        recommendation: candidate.recommendation || '',
        aiSummary: candidate.aiSummary || '',
        latestCandidateMessage,
        pastRoles: (candidate.pastRoles || []).join(', ')
      });
    });

    const chatSheet = workbook.addWorksheet('Chat Transcript');
    chatSheet.columns = [
      { header: 'Candidate Name', key: 'candidateName', width: 24 },
      { header: 'Status', key: 'status', width: 18 },
      { header: 'Timestamp', key: 'timestamp', width: 24 },
      { header: 'Sender', key: 'sender', width: 20 },
      { header: 'Message', key: 'message', width: 100 }
    ];

    rankedCandidates.forEach((candidate) => {
      const chatHistory = Array.isArray(candidate.chatHistory) ? candidate.chatHistory : [];
      if (!chatHistory.length) {
        chatSheet.addRow({
          candidateName: candidate.name || '',
          status: candidate.status || '',
          timestamp: '',
          sender: '',
          message: 'No chat messages recorded.'
        });
        return;
      }

      chatHistory.forEach((msg) => {
        chatSheet.addRow({
          candidateName: candidate.name || '',
          status: candidate.status || '',
          timestamp: msg.timestamp ? new Date(msg.timestamp).toISOString() : '',
          sender: msg.sender || '',
          message: msg.text || ''
        });
      });
    });

    [summarySheet, detailSheet, chatSheet].forEach((sheet) => {
      const headerRow = sheet.getRow(1);
      headerRow.font = { bold: true };
      headerRow.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
      headerRow.eachCell((cell) => {
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFE5E7EB' }
        };
        cell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' }
        };
      });
    });

    detailSheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;
      row.alignment = { vertical: 'top', wrapText: true };
      row.height = 48;
    });

    const safeTitle = String(campaign.title || 'campaign')
      .replace(/[^a-z0-9]+/gi, '_')
      .replace(/^_+|_+$/g, '')
      .toLowerCase();
    const filename = `${safeTitle || 'campaign'}_${scope}_report.xlsx`;

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error('Error exporting campaign report:', error);
    res.status(500).json({ error: 'Failed to export campaign report' });
  }
};
