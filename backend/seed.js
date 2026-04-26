require('dotenv').config();
const mongoose = require('mongoose');
const Candidate = require('./models/Candidate');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/talentpulse';

const firstNames = ["Alice", "Bob", "Charlie", "Diana", "Evan", "Fiona", "George", "Hannah", "Ian", "Julia", "Kevin", "Luna", "Mason", "Nora", "Oscar", "Penelope", "Quinn", "Riley", "Sam", "Tara", "Ulysses", "Victoria", "Wyatt", "Xenia", "Yusuf", "Zara"];
const lastNames = ["Smith", "Johnson", "Williams", "Jones", "Brown", "Davis", "Miller", "Wilson", "Moore", "Taylor", "Anderson", "Thomas", "Jackson", "White", "Harris", "Martin", "Thompson", "Garcia", "Martinez", "Robinson"];

const skillPool = [
  "React", "Node.js", "Tailwind CSS", "MongoDB", "Python", "Django", "PostgreSQL", "Docker", "Vue.js", "Express.js", 
  "Firebase", "Figma", "TypeScript", "AWS", "GraphQL", "Java", "Spring Boot", "MySQL", "Kubernetes", "Angular",
  "Ruby on Rails", "PHP", "Laravel", "C#", ".NET", "Redis", "Elasticsearch", "Swift", "Kotlin", "Flutter",
  "React Native", "Go", "Rust", "GCP", "Azure", "Terraform", "Jenkins", "CI/CD", "Next.js", "Svelte"
];

const locations = ["New York, NY", "San Francisco, CA", "Austin, TX", "Seattle, WA", "Chicago, IL", "Remote", "London, UK", "Toronto, ON", "Berlin, Germany", "Sydney, AUS"];
const availabilities = ["Immediate", "2 weeks notice", "1 month notice", "Currently employed (Passive)"];
const rolePrefixes = ["Junior", "Mid-Level", "Senior", "Lead", "Principal"];
const roleTypes = ["Frontend Developer", "Backend Developer", "Full Stack Engineer", "Software Engineer", "DevOps Engineer", "Data Scientist", "Mobile Developer"];

function getRandomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function getRandomItems(arr, count) {
  const shuffled = arr.sort(() => 0.5 - Math.random());
  return shuffled.slice(0, count);
}

const generateCandidates = (num) => {
  const candidates = [];
  for (let i = 0; i < num; i++) {
    const name = `${firstNames[getRandomInt(0, firstNames.length - 1)]} ${lastNames[getRandomInt(0, lastNames.length - 1)]}`;
    const skills = getRandomItems(skillPool, getRandomInt(4, 9));
    const experience = getRandomInt(1, 15);
    const location = locations[getRandomInt(0, locations.length - 1)];
    const availability = availabilities[getRandomInt(0, availabilities.length - 1)];
    const pastRoles = [
      `${rolePrefixes[getRandomInt(0, rolePrefixes.length - 1)]} ${roleTypes[getRandomInt(0, roleTypes.length - 1)]}`,
      `${roleTypes[getRandomInt(0, roleTypes.length - 1)]}`
    ];
    
    candidates.push({ name, skills, experience, location, availability, pastRoles });
  }
  return candidates;
};

const seedData = generateCandidates(50); // Generates 50 rich candidate profiles

mongoose.connect(MONGODB_URI)
  .then(async () => {
    console.log('MongoDB Connected for Seeding');
    await Candidate.deleteMany({});
    console.log('Cleared existing candidates');
    await Candidate.insertMany(seedData);
    console.log(`Inserted ${seedData.length} seed candidates successfully!`);
    mongoose.connection.close();
  })
  .catch(err => {
    console.error('Seeding Error:', err);
    process.exit(1);
  });
