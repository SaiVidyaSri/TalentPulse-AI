# TalentPulse AI

TalentPulse AI is an AI-assisted hiring workflow that helps recruiters parse job descriptions, score candidates, simulate engagement, and produce ranked shortlists with exportable reports.

## What This App Does

1. Parses raw job descriptions into structured requirements.
2. Scores candidates by skill match and experience fit.
3. Simulates recruiter-candidate conversations to gauge interest.
4. Ranks candidates using both match and interest signals.
5. Exports campaign summaries and ranked shortlists to Excel.

## Project Structure

```
TalentPulseAI/
  backend/
    controllers/
    models/
    routes/
    utils/
    server.js
    seed.js
  frontend/
    src/
      components/
      pages/
```

## Tech Stack

**Frontend**
- React 19 + Vite 8
- Tailwind CSS 4
- Framer Motion
- Recharts
- Axios
- Lucide React

**Backend**
- Node.js
- Express 5
- MongoDB + Mongoose 9
- dotenv
- Google Generative AI SDK (Gemini)
- ExcelJS

## Features

### Job Description Parsing
- Extracts `roleTitle`, `experienceLevel`, and `requiredSkills` from raw JD text.
- Uses Gemini when available with fallback parsing if quota is exceeded.

### Candidate Matching Engine
- Computes `matchScore` from:
  - Skill overlap
  - Experience fit
  - Role similarity
- Creates a campaign with ranked candidates and explanations.

### AI Engagement Simulation
- Generates multi-round recruiter-candidate conversations.
- Updates `interestScore` and `finalScore` based on simulated responses.
- Fallback responses are used when AI quota is hit.

### Ranking & Analytics
- Finalized shortlist view with score comparisons.
- Dashboard summaries and charts.
- AI summaries and recommendations per candidate.

### Excel Export
- Downloads `.xlsx` reports containing:
  - Campaign summary
  - Ranked candidates
  - Skills coverage
  - Chat transcript

## Environment Variables

Create `backend/.env`:

```
PORT=5000
MONGODB_URI=mongodb://localhost:27017/talentpulse
GEMINI_API_KEY=your_gemini_api_key
```

**Notes**
- If `MONGODB_URI` is missing, it defaults to `mongodb://localhost:27017/talentpulse`.
- If `GEMINI_API_KEY` is missing or rate-limited, fallback logic is used.

## Setup & Run

### 1) Install Dependencies

```
# Backend
cd backend
npm install

# Frontend
cd ../frontend
npm install
```

### 2) Seed Sample Data (Optional)

```
cd backend
node seed.js
```

### 3) Start the Apps

```
# Backend
cd backend
node server.js

# Frontend
cd frontend
npm run dev
```

**Default URLs**
- Frontend: `http://localhost:5173`
- Backend API: `http://localhost:5000/api`

## Core Data Model (High Level)

**Candidate**
- `name`, `skills`, `experience`, `location`, `availability`, `pastRoles`

**Campaign**
- `title`, `roleTitle`, `requiredSkills`, `experienceLevel`
- `matchedCandidates[]` with:
  - `matchScore`, `interestScore`, `finalScore`
  - `explanation`, `chatHistory`, `status`

## Scoring Logic

**Match Score**
- Skill overlap, experience fit, and role similarity combined into a 0–100 score.

**Interest Score**
- Derived from candidate responses in simulated engagement.
- Fallback scoring is used when AI is unavailable.

**Final Score**
- Weighted blend of match and interest:
  - `finalScore = matchScore * 0.6 + interestScore * 0.4`

## Key UI Pages

- **Job Input**: Paste JD and generate requirements.
- **Candidate Ranking**: Ranked candidates with chat simulation.
- **Dashboard**: Overview metrics and charts.
- **Executive Shortlist**: Finalized candidates with score comparison and export.

## API Endpoints

Base URL: `http://localhost:5000/api`

- `POST /parse-jd`
- `POST /match-candidates`
- `GET /candidates`
- `POST /start-chat`
- `POST /simulate-engagement`
- `GET /campaigns`
- `GET /campaigns/:id/results`
- `GET /campaigns/:id/export-excel?scope=engaged|pending|all`

## Example Requests

### Parse Job Description

```
POST /api/parse-jd
Content-Type: application/json

{
  "jdText": "We are hiring a Full Stack Engineer with 4+ years experience in React, Node.js, MongoDB and Docker."
}
```

### Match Candidates

```
POST /api/match-candidates
Content-Type: application/json

{
  "title": "Campaign for Full Stack Engineer",
  "roleTitle": "Full Stack Engineer",
  "requiredSkills": ["React", "Node.js", "MongoDB", "Docker"],
  "experienceLevel": 4
}
```

### Start Chat

```
POST /api/start-chat
Content-Type: application/json

{
  "campaignId": "69ede57f0e6ef9fba0e901d4",
  "candidateId": "69ede57f0e6ef9fba0e90011"
}
```

### Simulate Engagement

```
POST /api/simulate-engagement
Content-Type: application/json

{
  "campaignId": "69ede57f0e6ef9fba0e901d4",
  "candidateId": "69ede57f0e6ef9fba0e90011",
  "messages": [
    { "sender": "AI Recruiter", "text": "Are you interested for this role?" },
    { "sender": "Ian White", "text": "Yes, I'd like to learn more." },
    { "sender": "AI Recruiter", "text": "Tell me about your recent projects." }
  ]
}
```

## Troubleshooting

- **Gemini quota exceeded**: The app falls back to rule-based parsing and replies.
- **MongoDB connection errors**: Check `MONGODB_URI` in `backend/.env`.
- **Backend not starting**: Run `node server.js` from `backend`.

## Links

- **GitHub URL**: `https://github.com/SaiVidyaSri/TalentPulse-AI`
- **Deploy URL**: `<update-me>`
