require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const apiRoutes = require('./routes/api');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

app.use('/api', apiRoutes);

// Database connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/talentpulse')
.then(() => console.log('MongoDB connected'))
.catch(err => console.log('MongoDB connection error:', err));

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
