import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar';
import Dashboard from './pages/Dashboard';
import JobInput from './pages/JobInput';
import CandidateRanking from './pages/CandidateRanking';

import ExecutiveShortlist from './pages/ExecutiveShortlist';

function App() {
  const [darkMode, setDarkMode] = useState(false);

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  return (
    <Router>
      <div className="min-h-screen transition-colors duration-300 dark:bg-slate-900 dark:text-slate-50">
        <Navbar darkMode={darkMode} setDarkMode={setDarkMode} />
        <main className="container mx-auto px-4 py-8">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/job-input" element={<JobInput />} />
            <Route path="/ranking/:campaignId" element={<CandidateRanking />} />
            <Route path="/shortlist/:campaignId" element={<ExecutiveShortlist />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;
