const { GoogleGenerativeAI } = require('@google/generative-ai');
const mongoose = require('mongoose');
const Candidate = require('../models/Candidate');
const JobCampaign = require('../models/JobCampaign');
const { summarizeInterestTone, inferInterestScoreFromReply } = require('../utils/interestScorer');

const apiKey = process.env.GEMINI_API_KEY;
const genAI = apiKey ? new GoogleGenerativeAI(apiKey) : null;

const extractJsonFromModelOutput = (responseText) => {
  if (!responseText || typeof responseText !== 'string') return null;

  const fencedMatch = responseText.match(/```json\s*([\s\S]*?)```/i) || responseText.match(/```\s*([\s\S]*?)```/);
  const candidateText = fencedMatch ? fencedMatch[1].trim() : responseText.trim();

  try {
    return JSON.parse(candidateText);
  } catch (_) {
    const firstBrace = candidateText.indexOf('{');
    const lastBrace = candidateText.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      const sliced = candidateText.slice(firstBrace, lastBrace + 1);
      try {
        return JSON.parse(sliced);
      } catch (_) {
        return null;
      }
    }
    return null;
  }
};

// Use shared summarizeInterestTone from utils

const extractPlainReplyFromModelOutput = (responseText) => {
  const raw = String(responseText || '').trim();
  if (!raw) return null;

  const withoutFences = raw
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```$/i, '')
    .trim();

  // If model returned plain text instead of JSON, use it as reply.
  if (!withoutFences.startsWith('{') && !withoutFences.startsWith('[')) {
    return withoutFences;
  }

  return null;
};

const pickVariant = (variants, seed) => {
  if (!Array.isArray(variants) || variants.length === 0) return '';
  const index = Math.abs(seed) % variants.length;
  return variants[index];
};

const buildSeed = (...parts) => {
  const raw = parts.map((p) => String(p || '')).join('|');
  let hash = 0;
  for (let i = 0; i < raw.length; i += 1) {
    hash = ((hash << 5) - hash) + raw.charCodeAt(i);
    hash |= 0;
  }
  return hash;
};

const buildContextualFallbackReply = ({ latestRecruiterMessage, candidateName, roleTitle, skills, pastRoles, availability, turnIndex }) => {
  const msg = String(latestRecruiterMessage || '').toLowerCase();
  const topSkills = (Array.isArray(skills) ? skills : []).slice(0, 3);
  const topRoles = (Array.isArray(pastRoles) ? pastRoles : []).slice(0, 2);
  const role = roleTitle || 'this role';
  const seed = buildSeed(latestRecruiterMessage, candidateName, role, turnIndex);

  if (msg.includes('project')) {
    const projectContext = topRoles.length ? `In my recent ${topRoles[0]} work` : 'In my recent work';
    const skillContext = topSkills.length ? `I used ${topSkills.join(', ')}` : 'I focused on end-to-end delivery and collaboration';
    const variants = [
      `${projectContext}, ${skillContext} to ship features with measurable impact. I can share more specific project outcomes if helpful.`,
      `${projectContext}, ${skillContext} to deliver customer-facing improvements. If useful, I can walk you through scope, challenges, and results.`,
      `${projectContext}, ${skillContext} while coordinating with product and QA. Happy to share one project in detail including outcomes.`
    ];
    return pickVariant(variants, seed);
  }

  if (msg.includes('interest') || msg.includes('why') || msg.includes('role')) {
    const skillContext = topSkills.length ? `my experience with ${topSkills.join(', ')}` : 'my product and engineering experience';
    const variants = [
      `Yes, I am genuinely interested in ${role}. The role aligns well with ${skillContext}, and I would like to understand the team goals and priorities.`,
      `I am definitely interested in ${role}. It matches ${skillContext}, and I would value learning more about ownership and impact expectations.`,
      `Yes, this role is relevant to my background. My work in ${skillContext} maps well, and I am keen to discuss the roadmap and next steps.`
    ];
    return pickVariant(variants, seed);
  }

  if (msg.includes('availability') || msg.includes('notice') || msg.includes('join')) {
    if (availability) {
      const variants = [
        `I am currently ${availability}. If the scope and fit look right, I can coordinate next steps accordingly.`,
        `My current availability is ${availability}. I can align timelines once we confirm role scope and mutual fit.`,
        `I am ${availability} at the moment, and I am open to planning interview and joining timelines with your team.`
      ];
      return pickVariant(variants, seed);
    }
    return pickVariant([
      'I can discuss availability in detail and align timelines based on your hiring process.',
      'I am open to sharing joining timelines and coordinating based on your process milestones.',
      'Happy to discuss notice period and availability so we can set realistic next steps.'
    ], seed);
  }

  if (msg.includes('salary') || msg.includes('compensation') || msg.includes('ctc')) {
    return pickVariant([
      'I am open to discussing compensation based on role scope, responsibilities, and growth path. Happy to align on a fair range.',
      'I am flexible on compensation discussions and would like to align based on expectations, impact, and total package.',
      'I am comfortable discussing CTC based on role depth and responsibilities once we align on fit.'
    ], seed);
  }

  if (msg.includes('remote') || msg.includes('location')) {
    return pickVariant([
      'I am open to discussing work setup and location expectations. I can adapt based on team needs.',
      'I am flexible on remote or hybrid setup and can align with the team working model.',
      'I can work with your preferred location model and coordinate accordingly.'
    ], seed);
  }

  return pickVariant([
    `Thanks for the follow-up. I am interested in ${role} and would like to continue the conversation with more specifics on responsibilities and next steps.`,
    `Appreciate the update. I am interested in ${role} and would like to understand priorities, team structure, and expected outcomes.`,
    `Thank you for the message. I am positive about ${role} and happy to continue with detailed discussion on scope and next steps.`
  ], seed);
};

const makeReplyNonRepeating = ({ reply, previousCandidateReply, latestRecruiterMessage, fallbackReply }) => {
  const normalizedReply = String(reply || '').trim();
  const normalizedPrev = String(previousCandidateReply || '').trim();
  if (!normalizedReply) return fallbackReply;
  if (!normalizedPrev) return normalizedReply;

  if (normalizedReply.toLowerCase() === normalizedPrev.toLowerCase()) {
    const recruiterPrompt = String(latestRecruiterMessage || '').trim();
    if (recruiterPrompt) {
      return `${normalizedReply} Also, regarding your question "${recruiterPrompt}", I can share more specifics.`;
    }
    return `${normalizedReply} I can also provide additional details based on your priorities for the role.`;
  }

  return normalizedReply;
};

const buildInitialProfileChatFallback = ({ candidateName, roleTitle, skills, pastRoles, availability, matchScore }) => {
  const topSkills = (Array.isArray(skills) ? skills : []).slice(0, 3);
  const topRoles = (Array.isArray(pastRoles) ? pastRoles : []).slice(0, 2);
  const role = roleTitle || 'this role';
  const skillText = topSkills.length ? topSkills.join(', ') : 'relevant technical skills';
  const roleText = topRoles.length ? topRoles.join(' and ') : 'similar engineering roles';
  const availabilityText = availability || 'open to discussing timelines';

  const recruiter1 = `Hi ${candidateName}, we are hiring for ${role}. Your profile looks relevant, especially around ${skillText}. Are you open to exploring this opportunity?`;
  const candidate1 = matchScore >= 70
    ? `Yes, I am interested. ${role} aligns well with my background in ${skillText}.`
    : `I am open to exploring it. I may need some clarity on scope, but I am interested in discussing further.`;

  const recruiter2 = `Great. How do you see your experience with ${topSkills[0] || 'your core skills'} helping you succeed in this ${role} position?`;
  const candidate2 = `In my previous roles as ${roleText}, I've applied ${skillText} to solve complex problems and deliver high-quality code. I believe this experience allows me to contribute effectively to your team's objectives.`;

  const recruiter3 = `That sounds promising. Could you share a bit about a recent project where you had a significant impact using these skills?`;
  const candidate3 = `Recently, I worked on a project where I optimized backend performance using ${topSkills[1] || 'modern frameworks'}. This resulted in a 30% reduction in latency and improved overall system stability for our users.`;

  const recruiter4 = `Impressive. Lastly, what is your current availability and what would you need from our side to move forward?`;
  const candidate4 = `I am currently ${availabilityText}. To move forward, I'd like to understand more about the team structure, the specific technical challenges ahead, and the next steps in your process.`;

  const avgInterest = inferInterestScoreFromReply(`${candidate1} ${candidate2} ${candidate3} ${candidate4}`, 72);
  const boostedByMatch = Math.round((avgInterest * 0.7) + ((Number(matchScore) || 0) * 0.3));
  const interestScore = Math.max(45, Math.min(95, boostedByMatch));

  return {
    chatHistory: [
      { sender: 'AI Recruiter', text: recruiter1 },
      { sender: candidateName, text: candidate1 },
      { sender: 'AI Recruiter', text: recruiter2 },
      { sender: candidateName, text: candidate2 },
      { sender: 'AI Recruiter', text: recruiter3 },
      { sender: candidateName, text: candidate3 },
      { sender: 'AI Recruiter', text: recruiter4 },
      { sender: candidateName, text: candidate4 }
    ],
    interestScore
  };
};

const resolveCandidateId = (candidateRef) => {
  if (!candidateRef) return null;
  if (typeof candidateRef === 'string') return candidateRef;
  if (candidateRef._id) return String(candidateRef._id);
  return String(candidateRef);
};

exports.getCandidates = async (req, res) => {
  try {
    const candidates = await Candidate.find();
    res.json(candidates);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch candidates' });
  }
};

exports.startChat = async (req, res) => {
  try {
    const { campaignId, candidateId } = req.body;
    
    if (!campaignId || !candidateId) return res.status(400).json({ error: 'Campaign ID and Candidate ID are required' });
    if (!mongoose.Types.ObjectId.isValid(candidateId)) {
      return res.status(400).json({ error: 'Invalid candidate ID' });
    }
    if (campaignId !== 'latest' && !mongoose.Types.ObjectId.isValid(campaignId)) {
      return res.status(400).json({ error: 'Invalid campaign ID' });
    }

    let campaign;
    if (campaignId === 'latest') {
      campaign = await JobCampaign.findOne().sort({ createdAt: -1 }).populate('matchedCandidates.candidate');
    } else {
      campaign = await JobCampaign.findById(campaignId).populate('matchedCandidates.candidate');
    }
    
    if (!campaign) return res.status(404).json({ error: 'Campaign not found' });

    const matchedCandidates = Array.isArray(campaign.matchedCandidates) ? campaign.matchedCandidates : [];
    if (!matchedCandidates.length) {
      return res.status(404).json({ error: 'No matched candidates found for this campaign' });
    }

    const matchEntry = matchedCandidates.find((mc) => resolveCandidateId(mc.candidate) === String(candidateId));
    if (!matchEntry) return res.status(404).json({ error: 'Candidate not found in this campaign' });

    // Determine if we need to regenerate/update the chat (if it's missing or only has 1-2 messages)
    const needsMultiRoundChat = !matchEntry.chatHistory || matchEntry.chatHistory.length < 8;

    if (!needsMultiRoundChat) {
      return res.json({ chatHistory: matchEntry.chatHistory });
    }

    // Otherwise, dynamically generate opening outreach and reply based on CAMPAIGN JD
    const model = genAI ? genAI.getGenerativeModel({ model: "gemini-1.5-flash" }) : null;
    const candidateName = matchEntry.candidate?.name || 'Candidate';
    const requiredSkills = Array.isArray(campaign.requiredSkills) ? campaign.requiredSkills : [];
    const candidateSkills = Array.isArray(matchEntry.candidate.skills) ? matchEntry.candidate.skills : [];
    
    const candidatePastRoles = Array.isArray(matchEntry.candidate?.pastRoles) ? matchEntry.candidate.pastRoles : [];
    const candidateAvailability = matchEntry.candidate?.availability || '';

    const prompt = `
      You are roleplaying a realistic, professional pre-screening interview between an AI Recruiter and a candidate named ${candidateName}.
      
      Job Context:
      Role: ${campaign.roleTitle || 'this role'}
      Required Skills: ${requiredSkills.join(', ')}
      
      Candidate Profile:
      Skills: ${candidateSkills.join(', ')}
      Past Roles: ${candidatePastRoles.join(', ')}
      Availability: ${candidateAvailability}
      Match Score: ${matchEntry.matchScore}%
      Match Explanation: ${matchEntry.explanation}

      Task:
      Generate a comprehensive 4-round initial conversation (8 messages total: 4 from AI Recruiter, 4 from ${candidateName}).
      
      Conversation Flow:
      Round 1: AI Recruiter introduces the role and asks about initial interest. Candidate expresses interest level and mentions relevant background.
      Round 2: AI Recruiter asks a specific follow-up question about how the candidate's skills (like ${candidateSkills.slice(0, 2).join(' or ')}) align with the job's needs. Candidate provides a detailed, profile-specific answer showing depth of experience.
      Round 3: AI Recruiter asks about a significant project or achievement from the candidate's past roles (${candidatePastRoles.slice(0, 1).join('')}). Candidate describes a concrete project with specific impact metrics or results.
      Round 4: AI Recruiter asks about logistics (availability, notice period, expectations). Candidate responds naturally, showing flexibility and commitment level.

      Goal:
      1. Analyze the candidate's profile depth and relevance to the specific job.
      2. Ensure the candidate's tone is professional and context-aware.
      3. Determine an "interestScore" (0-100) based on:
         - Enthusiasm and engagement in responses (higher for eager, lower for hesitant)
         - Specificity and depth of answers (higher for detailed, lower for vague)
         - Fit with role requirements (higher for aligned skills, lower for gaps)
         - Availability and logistics fit (higher for immediate/flexible, lower for constraints)

      Format output as strict JSON object:
      {
        "conversation": [
          {"sender": "AI Recruiter", "text": "..."},
          {"sender": "${candidateName}", "text": "..."}
        ],
        "interestScore": 0-100
      }

      Keep exactly 8 conversation messages total.
    `;

    let parsedData = null;
    if (model) {
      try {
        const result = await model.generateContent(prompt);
        const responseText = result.response.text();
        parsedData = extractJsonFromModelOutput(responseText);
        if (!parsedData) {
          console.log('JSON parsing failed:', responseText);
        }
      } catch (aiError) {
        console.error('Gemini startChat failed, using fallback:', aiError?.message || aiError);
      }
    }

    let nextChatHistory = [];
    let parsedInterestScore = Number(parsedData?.interestScore);

    if (parsedData && Array.isArray(parsedData.conversation) && parsedData.conversation.length >= 2) {
      nextChatHistory = parsedData.conversation
        .filter((msg) => msg && msg.sender && typeof msg.text === 'string')
        .slice(0, 8)
        .map((msg) => ({ sender: msg.sender, text: msg.text }));
    }

    if (!nextChatHistory.length) {
      const fallbackInit = buildInitialProfileChatFallback({
        candidateName,
        roleTitle: campaign.roleTitle,
        skills: candidateSkills,
        pastRoles: candidatePastRoles,
        availability: candidateAvailability,
        matchScore: matchEntry.matchScore
      });
      nextChatHistory = fallbackInit.chatHistory;
      parsedInterestScore = fallbackInit.interestScore;
    }

    if (!Number.isFinite(parsedInterestScore)) {
      const { interestScore } = summarizeInterestTone(nextChatHistory);
      parsedInterestScore = interestScore;
    }

    const normalizedInterestScore = Number.isFinite(parsedInterestScore)
      ? parsedInterestScore
      : 70;
    const nextFinalScore = Math.round((matchEntry.matchScore * 0.6) + (normalizedInterestScore * 0.4));

    const updateResult = await JobCampaign.updateOne(
      {
        _id: campaign._id,
        'matchedCandidates.candidate': candidateId
      },
      {
        $set: {
          'matchedCandidates.$.chatHistory': nextChatHistory,
          'matchedCandidates.$.interestScore': normalizedInterestScore,
          'matchedCandidates.$.finalScore': nextFinalScore,
          'matchedCandidates.$.status': 'Engaged'
        }
      }
    );

    if (updateResult.modifiedCount === 0) {
      const refreshedCampaign = await JobCampaign.findById(campaign._id).populate('matchedCandidates.candidate');
      if (!refreshedCampaign) return res.status(404).json({ error: 'Campaign not found' });

      const refreshedCandidates = Array.isArray(refreshedCampaign.matchedCandidates) ? refreshedCampaign.matchedCandidates : [];
      const refreshedMatchEntry = refreshedCandidates.find((mc) => resolveCandidateId(mc.candidate) === String(candidateId));
      if (!refreshedMatchEntry) return res.status(404).json({ error: 'Candidate not found in this campaign' });

      return res.json({ chatHistory: refreshedMatchEntry.chatHistory || [] });
    }

    res.json({ chatHistory: nextChatHistory });

  } catch (error) {
    console.error('Error starting chat:', error);
    if (error.status === 503) {
      return res.status(503).json({ error: 'Google Gemini AI is currently experiencing high demand. Please try again later.' });
    }
    res.status(500).json({ error: `Error starting chat: ${error.message || 'Unknown error'}` });
  }
};

exports.simulateEngagement = async (req, res) => {
  try {
    const { campaignId, candidateId, messages } = req.body;
    
    if (!campaignId || !candidateId || !messages) {
      return res.status(400).json({ error: 'Campaign ID, Candidate ID, and messages are required' });
    }
    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: 'Messages must be a non-empty array' });
    }
    if (!mongoose.Types.ObjectId.isValid(candidateId)) {
      return res.status(400).json({ error: 'Invalid candidate ID' });
    }
    if (campaignId !== 'latest' && !mongoose.Types.ObjectId.isValid(campaignId)) {
      return res.status(400).json({ error: 'Invalid campaign ID' });
    }

    let campaign;
    if (campaignId === 'latest') {
      campaign = await JobCampaign.findOne().sort({ createdAt: -1 }).populate('matchedCandidates.candidate');
    } else {
      campaign = await JobCampaign.findById(campaignId).populate('matchedCandidates.candidate');
    }
    
    if (!campaign) return res.status(404).json({ error: 'Campaign not found' });

    const matchedCandidates = Array.isArray(campaign.matchedCandidates) ? campaign.matchedCandidates : [];
    if (!matchedCandidates.length) {
      return res.status(404).json({ error: 'No matched candidates found for this campaign' });
    }

    const matchEntry = matchedCandidates.find((mc) => resolveCandidateId(mc.candidate) === String(candidateId));
    if (!matchEntry) return res.status(404).json({ error: 'Candidate not found in this campaign' });

    const model = genAI ? genAI.getGenerativeModel({ model: "gemini-1.5-flash" }) : null;
    const candidateName = matchEntry.candidate?.name || 'Candidate';
    const candidateSkills = Array.isArray(matchEntry.candidate.skills) ? matchEntry.candidate.skills : [];
    const candidatePastRoles = Array.isArray(matchEntry.candidate?.pastRoles) ? matchEntry.candidate.pastRoles : [];
    const candidateAvailability = matchEntry.candidate?.availability || '';
    
    let chatHistoryStr = messages.map(m => `${m.sender}: ${m.text}`).join('\n');
    const userLastMessage = messages[messages.length - 1] || {};
    const latestRecruiterMessage = typeof userLastMessage.text === 'string' ? userLastMessage.text.trim() : '';
    const previousCandidateReply = [...messages]
      .reverse()
      .find((msg) => msg && msg.sender && msg.sender !== 'AI Recruiter' && msg.sender !== 'Human Recruiter' && msg.sender !== 'System')?.text || '';

    const lastSender = userLastMessage.sender || 'AI Recruiter';
    const isHuman = lastSender === 'Human Recruiter';

    const prompt = `
      You are simulating a job candidate named ${candidateName} in a chat for a ${campaign.roleTitle} role.
      Profile: Skills: ${candidateSkills.join(', ')} | Experience: ${matchEntry.candidate.experience} years | Availability: ${candidateAvailability}.
      
      Conversation so far:
      ${chatHistoryStr}

      Latest message from ${lastSender}:
      "${latestRecruiterMessage}"
      
      Instructions:
      1. Provide your next reply as the candidate, directly answering the latest message with specific examples when relevant.
      2. Keep it natural, specific, and avoid repeating previous wording.
      3. ${isHuman ? 'A human recruiter has joined the chat. Be slightly more professional and detailed, showing genuine interest and engagement.' : 'You are currently chatting with an AI Recruiter. Keep responses concise, informative, and demonstrate specific interest in the role.'}
      4. Determine your current "Interest Level" in the job based on the conversation considering:
         - Enthusiasm shown for the role (75+ if very interested, 50-75 if interested, below 50 if skeptical)
         - Alignment with your skills and experience (add points if it matches your background)
         - Your understanding of the role (add points if questions show deep engagement)
      
      Format response strictly as a JSON object:
      - reply: your text response
      - interestScore: integer (0-100)
    `;

    let parsedData = null;
    let rawModelOutput = '';
    if (model) {
      try {
        const result = await model.generateContent(prompt);
        rawModelOutput = result.response.text();
        parsedData = extractJsonFromModelOutput(rawModelOutput);
        if (!parsedData) {
          console.log('JSON parsing failed:', rawModelOutput);
        }
      } catch (aiError) {
        console.error('Gemini simulateEngagement failed, using fallback:', aiError?.message || aiError);
      }
    }

    const contextualFallbackReply = buildContextualFallbackReply({
      latestRecruiterMessage,
      candidateName,
      roleTitle: campaign.roleTitle,
      skills: candidateSkills,
      pastRoles: candidatePastRoles,
      availability: candidateAvailability,
      turnIndex: messages.length
    });

    if (!parsedData) {
      const plainReply = extractPlainReplyFromModelOutput(rawModelOutput);
      const tempHistory = [...messages, { sender: candidateName, text: plainReply || contextualFallbackReply }];
      const { interestScore } = summarizeInterestTone(tempHistory);
      parsedData = {
        reply: plainReply || contextualFallbackReply,
        interestScore
      };
    }

    if (!parsedData.reply || typeof parsedData.reply !== 'string') {
      parsedData.reply = contextualFallbackReply;
    }

    parsedData.reply = makeReplyNonRepeating({
      reply: parsedData.reply,
      previousCandidateReply,
      latestRecruiterMessage,
      fallbackReply: contextualFallbackReply
    });

    // Save user's last message and candidate's new reply to history
    const safeUserSender = typeof userLastMessage.sender === 'string' && userLastMessage.sender.trim()
      ? userLastMessage.sender
      : (isHuman ? 'Human Recruiter' : 'AI Recruiter');
    const safeUserText = typeof userLastMessage.text === 'string' && userLastMessage.text.trim()
      ? userLastMessage.text
      : '';
    const historyEntries = [
      { sender: safeUserSender, text: safeUserText, timestamp: new Date() },
      { sender: candidateName, text: parsedData.reply, timestamp: new Date() }
    ];

    const updateOperations = {
      $push: {
        'matchedCandidates.$.chatHistory': { $each: historyEntries }
      }
    };

    const parsedInterestScore = Number(parsedData.interestScore);
    if (parsedData.interestScore !== undefined) {
      const normalizedInterestScore = Number.isFinite(parsedInterestScore)
        ? parsedInterestScore
        : matchEntry.interestScore;
      updateOperations.$set = {
        'matchedCandidates.$.interestScore': normalizedInterestScore,
        'matchedCandidates.$.finalScore': Math.round((matchEntry.matchScore * 0.6) + (normalizedInterestScore * 0.4))
      };
    }

    const updateResult = await JobCampaign.updateOne(
      {
        _id: campaign._id,
        matchedCandidates: { $elemMatch: { candidate: candidateId } }
      },
      updateOperations
    );

    if (updateResult.matchedCount === 0) {
      return res.status(404).json({ error: 'Candidate not found in this campaign' });
    }

    const updatedCampaign = await JobCampaign.findById(campaign._id).populate('matchedCandidates.candidate');
    if (!updatedCampaign) return res.status(404).json({ error: 'Campaign not found' });
    const updatedCandidates = Array.isArray(updatedCampaign.matchedCandidates) ? updatedCampaign.matchedCandidates : [];
    const updatedMatchEntry = updatedCandidates.find((mc) => resolveCandidateId(mc.candidate) === String(candidateId));
    if (!updatedMatchEntry) return res.status(404).json({ error: 'Candidate not found in this campaign' });

    res.json({
      reply: parsedData.reply,
      interestScore: Number.isFinite(parsedInterestScore) ? parsedInterestScore : updatedMatchEntry.interestScore,
      chatHistory: updatedMatchEntry.chatHistory
    });

  } catch (error) {
    console.error('Error simulating engagement:', error);
    if (error.status === 503) {
      return res.status(503).json({ error: 'Google Gemini AI is currently experiencing high demand. Please try again later.' });
    }
    res.status(500).json({ error: `Error simulating engagement: ${error.message || 'Unknown error'}` });
  }
};
