const summarizeInterestTone = (chatHistory = []) => {
  // Ensure we are working with plain objects if it's a Mongoose array
  const history = Array.isArray(chatHistory) 
    ? chatHistory.map(m => (typeof m.toObject === 'function' ? m.toObject() : m))
    : [];

  const candidateMessages = history
    .filter((msg) => {
      if (!msg || !msg.sender || !msg.text) return false;
      const sender = String(msg.sender);
      return sender !== 'AI Recruiter' && sender !== 'Human Recruiter' && sender !== 'System';
    })
    .map((msg) => String(msg.text || '').toLowerCase());

  if (!candidateMessages.length) {
    // If we have history but no candidate messages, return a neutral score instead of 0
    // This handles cases where only recruiters have spoken so far
    return { 
      tone: 'unknown', 
      highlights: [], 
      interestScore: history.length > 0 ? 72 : 0 
    };
  }

  const positiveSignals = [
    'interested', 'excited', 'keen', 'yes', 'available', 'open to', 'looking forward', 
    'love to', 'happy to', 'sounds great', 'perfect', 'within 2 weeks', 'immediately', 
    'remote', 'prefer remote', 'actively looking', 'fits my background', 'sounds good',
    'good to me', 'certainly', 'definitely', 'sure', 'absolutely'
  ];
  const cautiousSignals = [
    'maybe', 'could', 'depends', 'need more details', 'not sure', 'concern', 
    'timeline', 'compensation', 'salary', 'notice period', 'clarity on scope',
    'negotiable', 'questions', 'details'
  ];
  const concernSignals = [
    'not interested', 'decline', 'cannot', 'unable', 'no thanks', 'pass', 'unavailable',
    'wrong role', 'not a fit'
  ];

  let positiveCount = 0;
  let cautiousCount = 0;
  let concernCount = 0;

  for (const line of candidateMessages) {
    if (positiveSignals.some((token) => line.includes(token))) positiveCount += 1;
    if (cautiousSignals.some((token) => line.includes(token))) cautiousCount += 1;
    if (concernSignals.some((token) => line.includes(token))) concernCount += 1;
  }

  let tone = 'balanced';
  let interestScore = 72; // Base score for starting conversation if no signals detected

  if (concernCount > 0) {
    tone = 'hesitant';
    interestScore = 40 - (concernCount * 5);
  } else if (positiveCount >= Math.max(1, cautiousCount)) {
    tone = 'positive';
    interestScore = 80 + (positiveCount * 2);
  } else if (cautiousCount > positiveCount) {
    tone = 'cautious';
    interestScore = 60 - (cautiousCount * 2);
  }

  // Adjust score based on message count (depth of engagement)
  interestScore += Math.min(10, candidateMessages.length * 2);
  
  interestScore = Math.max(30, Math.min(98, interestScore));

  const highlights = [];
  const lastCandidateReply = candidateMessages[candidateMessages.length - 1];
  if (lastCandidateReply) {
    highlights.push(lastCandidateReply.slice(0, 180));
  }

  return { tone, highlights, interestScore };
};

const inferInitialInterest = ({ matchScore, experience, experienceLevel, candidateName }) => {
  const base = 55;
  const matchBoost = (Number(matchScore) || 0) * 0.35;
  const expGap = Math.max(0, (Number(experienceLevel) || 0) - (Number(experience) || 0));
  const expPenalty = expGap * 3;
  
  // Add a bit of pseudo-random variance based on name to simulate different engagement levels
  const nameHash = String(candidateName || 'Candidate').split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const variance = (nameHash % 15) - 5; // -5 to +10

  return Math.max(50, Math.min(95, Math.round(base + matchBoost - expPenalty + variance)));
};

const buildInitialAutoConversation = ({ candidate, roleTitle, matchScore, matchedSkills }) => {
  const candidateName = candidate?.name || 'Candidate';
  const skills = Array.isArray(candidate?.skills) ? candidate.skills : [];
  const topSkills = (Array.isArray(matchedSkills) && matchedSkills.length ? matchedSkills : skills).slice(0, 3);
  const topRoles = (Array.isArray(candidate?.pastRoles) ? candidate.pastRoles : []).slice(0, 2);
  const availabilityText = candidate?.availability || 'open to discussing timelines';
  const role = roleTitle || 'this role';
  const skillText = topSkills.length ? topSkills.join(', ') : 'relevant technical skills';
  const roleText = topRoles.length ? topRoles.join(' and ') : 'similar engineering roles';

  const recruiter1 = `Hi ${candidateName}, we are hiring for ${role}. Your profile looks relevant, especially around ${skillText}. Are you open to exploring this opportunity?`;
  const candidate1 = matchScore >= 70
    ? `Yes, I am interested. ${role} aligns well with my recent work in ${skillText}.`
    : `I am open to exploring this role. I would like to understand responsibilities and growth expectations before deciding.`;

  const recruiter2 = 'Could you briefly share your recent projects that are most relevant here?';
  const candidate2 = `In my recent work as ${roleText}, I delivered backend features and collaborated across product and engineering to ship reliable releases.`;

  const recruiter3 = `That sounds promising. Could you share a bit about a recent project where you had a significant impact using ${topSkills[1] || 'these skills'}?`;
  const candidate3 = `Recently, I worked on a project where I optimized backend performance using ${topSkills[1] || 'modern frameworks'}. This resulted in a 30% reduction in latency and improved overall system stability for our users.`;

  const recruiter4 = `Impressive. Lastly, what is your current availability and what would you need from our side to move forward?`;
  const candidate4 = `I am currently ${availabilityText}. To move forward, I'd like to understand more about the team structure, the specific technical challenges ahead, and the next steps in your process.`;

  return [
    { sender: 'AI Recruiter', text: recruiter1 },
    { sender: candidateName, text: candidate1 },
    { sender: 'AI Recruiter', text: recruiter2 },
    { sender: candidateName, text: candidate2 },
    { sender: 'AI Recruiter', text: recruiter3 },
    { sender: candidateName, text: candidate3 },
    { sender: 'AI Recruiter', text: recruiter4 },
    { sender: candidateName, text: candidate4 }
  ];
};

const getSkillCoverage = (requiredSkills = [], candidateSkills = []) => {
  const safeRequired = Array.isArray(requiredSkills) ? requiredSkills : [];
  const safeCandidate = Array.isArray(candidateSkills) ? candidateSkills : [];

  const matched = safeRequired.filter((requiredSkill) =>
    safeCandidate.some(
      (skill) =>
        String(requiredSkill).toLowerCase().includes(String(skill).toLowerCase()) ||
        String(skill).toLowerCase().includes(String(requiredSkill).toLowerCase())
    )
  );

  const missing = safeRequired.filter((requiredSkill) =>
    !safeCandidate.some(
      (skill) =>
        String(requiredSkill).toLowerCase().includes(String(skill).toLowerCase()) ||
        String(skill).toLowerCase().includes(String(requiredSkill).toLowerCase())
    )
  );

  return { matched, missing };
};

const inferInterestScoreFromReply = (replyText = '', defaultScore = 72) => {
  const text = String(replyText || '').toLowerCase();
  
  if (!text) return defaultScore;
  
  const positiveSignals = [
    'interested', 'excited', 'keen', 'yes', 'available', 'open to', 'looking forward', 
    'love to', 'happy to', 'sounds great', 'perfect', 'within 2 weeks', 'immediately', 
    'remote', 'prefer remote', 'actively looking', 'fits my background', 'sounds good',
    'good to me', 'certainly', 'definitely', 'sure', 'absolutely'
  ];
  const cautiousSignals = [
    'maybe', 'could', 'depends', 'need more details', 'not sure', 'concern', 
    'timeline', 'compensation', 'salary', 'notice period', 'clarity on scope',
    'negotiable', 'questions', 'details'
  ];
  const concernSignals = [
    'not interested', 'decline', 'cannot', 'unable', 'no thanks', 'pass', 'unavailable',
    'wrong role', 'not a fit'
  ];

  let positiveCount = 0;
  let cautiousCount = 0;
  let concernCount = 0;

  if (positiveSignals.some((token) => text.includes(token))) positiveCount += 1;
  if (cautiousSignals.some((token) => text.includes(token))) cautiousCount += 1;
  if (concernSignals.some((token) => text.includes(token))) concernCount += 1;

  let interestScore = defaultScore;

  if (concernCount > 0) {
    interestScore = 40 - (concernCount * 5);
  } else if (positiveCount > cautiousCount) {
    interestScore = 80 + (positiveCount * 2);
  } else if (cautiousCount > positiveCount) {
    interestScore = 60 - (cautiousCount * 2);
  }

  return Math.max(30, Math.min(98, interestScore));
};

module.exports = {
  summarizeInterestTone,
  inferInitialInterest,
  inferInterestScoreFromReply,
  buildInitialAutoConversation,
  getSkillCoverage
};
