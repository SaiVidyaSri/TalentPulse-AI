const { GoogleGenerativeAI } = require('@google/generative-ai');
const Candidate = require('../models/Candidate');
const { inferInitialInterest, buildInitialAutoConversation, getSkillCoverage } = require('../utils/interestScorer');

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

const parseJdFallback = (jdText) => {
  const text = String(jdText || '');
  const lower = text.toLowerCase();

  const rolePatterns = [
    /(?:position|role|title)\s*[:\-]\s*([^\n\r]+)/i,
    /hiring\s+for\s+([^\n\r,.]+)/i,
    /looking\s+for\s+([^\n\r,.]+)/i
  ];

  let roleTitle = 'Software Engineer';
  for (const pattern of rolePatterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      roleTitle = match[1].trim();
      break;
    }
  }

  const expMatch = lower.match(/(\d+)\+?\s*(?:years|yrs)/i) || lower.match(/experience\s*[:\-]?\s*(\d+)/i);
  const experienceLevel = expMatch ? Number(expMatch[1]) : 2;

  const knownSkills = [
    'javascript', 'typescript', 'node.js', 'node', 'react', 'vue', 'angular', 'python', 'java', 'c#', 'go',
    'mongodb', 'sql', 'postgresql', 'mysql', 'redis', 'aws', 'azure', 'gcp', 'docker', 'kubernetes',
    'graphql', 'rest', 'api', 'flutter', 'swift', 'firebase', 'tailwind', 'next.js', 'express'
  ];

  const extractedSkills = knownSkills
    .filter((skill) => lower.includes(skill))
    .map((skill) => {
      if (skill === 'node') return 'Node.js';
      if (skill === 'rest') return 'REST API';
      if (skill === 'api') return 'API Design';
      return skill;
    });

  const uniqueSkills = Array.from(new Set(extractedSkills)).slice(0, 12);
  const requiredSkills = uniqueSkills.length ? uniqueSkills : ['Communication', 'Problem Solving'];

  return {
    requiredSkills,
    experienceLevel,
    roleTitle
  };
};

const normalizeParsedJd = (parsedData, fallbackData) => {
  const roleTitle = String(parsedData?.roleTitle || fallbackData.roleTitle || 'Software Engineer').trim();
  const experienceLevelValue = Number(parsedData?.experienceLevel);
  const experienceLevel = Number.isFinite(experienceLevelValue) ? experienceLevelValue : fallbackData.experienceLevel;

  const requiredSkillsRaw = Array.isArray(parsedData?.requiredSkills)
    ? parsedData.requiredSkills
    : fallbackData.requiredSkills;
  const requiredSkills = Array.from(
    new Set(
      requiredSkillsRaw
        .map((skill) => String(skill || '').trim())
        .filter(Boolean)
    )
  );

  return {
    requiredSkills: requiredSkills.length ? requiredSkills : fallbackData.requiredSkills,
    experienceLevel,
    roleTitle
  };
};

// Use shared interest scoring and conversation logic from utils

exports.parseJd = async (req, res) => {
  try {
    const { jdText } = req.body;
    if (!jdText) return res.status(400).json({ error: 'Job description text is required' });

    const fallbackData = parseJdFallback(jdText);

    if (!apiKey || !genAI) {
      return res.json(normalizeParsedJd(null, fallbackData));
    }

    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const prompt = `
      Extract the following information from the job description below.
      Format the response as a strict JSON object with these exact keys:
      - requiredSkills: an array of strings
      - experienceLevel: a number representing years of experience required (just the number)
      - roleTitle: a string representing the job title

      Job Description:
      ${jdText}
    `;

    const result = await model.generateContent(prompt);
    const responseText = result.response.text();

    const parsedData = extractJsonFromModelOutput(responseText);
    if (!parsedData) {
      console.log('Failed to parse JSON, raw text:', responseText);
      return res.json(normalizeParsedJd(null, fallbackData));
    }

    res.json(normalizeParsedJd(parsedData, fallbackData));
  } catch (error) {
    console.error('Error parsing JD:', error);
    try {
      const fallbackData = parseJdFallback(req.body?.jdText || '');
      return res.json(normalizeParsedJd(null, fallbackData));
    } catch (_) {
      return res.status(500).json({ error: 'Error parsing job description' });
    }
  }
};

const JobCampaign = require('../models/JobCampaign');

exports.matchCandidates = async (req, res) => {
  try {
    const { requiredSkills, experienceLevel, roleTitle, title } = req.body;
    
    if (!requiredSkills || experienceLevel === undefined) {
       return res.status(400).json({ error: 'Missing JD parsed data' });
    }

    const candidates = await Candidate.find();
    const matchedCandidates = [];
    
    for (let candidate of candidates) {
      // 1. Skill Match (0-100)
      const { matched: matchedSkills } = getSkillCoverage(requiredSkills, candidate.skills);
      const skillScore = requiredSkills.length > 0 ? (matchedSkills.length / requiredSkills.length) * 100 : 100;
      
      // 2. Experience Match (0-100)
      let expScore = 100;
      if (candidate.experience < experienceLevel) {
        expScore = Math.max(0, 100 - ((experienceLevel - candidate.experience) * 20));
      }
      
      // 3. Role Similarity (0-100)
      const hasSimilarRole = candidate.pastRoles.some(role => role.toLowerCase().includes(roleTitle.toLowerCase()));
      const roleScore = hasSimilarRole ? 100 : 50;
      
      // Overall Match Score
      const matchScore = Math.round((skillScore * 0.5) + (expScore * 0.3) + (roleScore * 0.2));
      
      // Generate explanation
      let explanation = `Matches ${matchedSkills.length}/${requiredSkills.length} required skills. `;
      if (candidate.experience >= experienceLevel) {
        explanation += `Meets experience requirement. `;
      } else {
        explanation += `Slightly below experience requirement. `;
      }
      explanation += hasSimilarRole ? `Similar previous role.` : `Different background but transferable skills.`;

      const interestScore = inferInitialInterest({
        matchScore,
        experience: candidate.experience,
        experienceLevel,
        candidateName: candidate.name
      });
      const finalScore = Math.round((matchScore * 0.6) + (interestScore * 0.4));
      const chatHistory = buildInitialAutoConversation({
        candidate,
        roleTitle,
        matchScore,
        matchedSkills
      });
      
      matchedCandidates.push({
        candidate: candidate._id,
        matchScore,
        explanation,
        status: 'Engaged',
        interestScore,
        finalScore,
        chatHistory
      });
    }
    
    const campaign = new JobCampaign({
      title: title || `Campaign for ${roleTitle}`,
      roleTitle,
      requiredSkills,
      experienceLevel,
      matchedCandidates
    });
    
    await campaign.save();
    
    res.json({ campaignId: campaign._id });
  } catch (error) {
    console.error('Error matching candidates:', error);
    res.status(500).json({ error: 'Error matching candidates' });
  }
};
