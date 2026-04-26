import { useState } from 'react';
import { motion } from 'framer-motion';
import { Sparkles, ArrowRight, Check } from 'lucide-react';
import axios from 'axios';
import { buildApiUrl } from '../utils/api';
import { useNavigate } from 'react-router-dom';

export default function JobInput() {
  const [jdText, setJdText] = useState('');
  const [loading, setLoading] = useState(false);
  const [parsedData, setParsedData] = useState(null);
  const [matching, setMatching] = useState(false);
  const navigate = useNavigate();

  const handleParse = async () => {
    if (!jdText) return;
    setLoading(true);
    try {
      const res = await axios.post(buildApiUrl('/parse-jd'), { jdText });
      setParsedData(res.data);
    } catch (error) {
      console.error('Error parsing JD:', error);
      const errorMessage = error.response?.data?.error || 'Error parsing JD. Make sure the backend is running and Gemini API key is configured.';
      alert(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleMatch = async () => {
    if (!parsedData) return;
    setMatching(true);
    try {
      const matchRes = await axios.post(buildApiUrl('/match-candidates'), {
        ...parsedData,
        title: `Campaign for ${parsedData.roleTitle}`
      });
      navigate(`/ranking/${matchRes.data.campaignId}`);
    } catch (error) {
      console.error('Error matching candidates:', error);
    } finally {
      setMatching(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Post a Job</h1>
        <p className="text-slate-500 dark:text-slate-400 mt-1">Paste your job description to let AI extract requirements.</p>
      </div>

      <div className="glass dark:glass-dark rounded-2xl p-8 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 dark:bg-indigo-500/5 rounded-full blur-3xl -mr-32 -mt-32 pointer-events-none"></div>
        
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
          Job Description
        </label>
        <textarea
          value={jdText}
          onChange={(e) => setJdText(e.target.value)}
          placeholder="Paste the full job description here..."
          className="w-full h-64 p-4 bg-white/50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all resize-none outline-none text-slate-900 dark:text-white"
        />

        <div className="mt-6 flex justify-end">
          <button
            onClick={handleParse}
            disabled={!jdText || loading}
            className="px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white rounded-xl font-medium shadow-lg shadow-indigo-500/30 transition-all flex items-center disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <span className="flex items-center"><div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div> Processing...</span>
            ) : (
              <span className="flex items-center"><Sparkles size={18} className="mr-2" /> Extract Requirements</span>
            )}
          </button>
        </div>
      </div>

      {parsedData && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass dark:glass-dark rounded-2xl p-8 border-l-4 border-pink-500"
        >
          <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-6">AI Extracted Requirements</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div>
              <div className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-1">Role Title</div>
              <div className="text-lg font-semibold text-slate-900 dark:text-white">{parsedData.roleTitle || 'Not found'}</div>
            </div>
            <div>
              <div className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-1">Experience Level</div>
              <div className="text-lg font-semibold text-slate-900 dark:text-white">{parsedData.experienceLevel} Years</div>
            </div>
          </div>

          <div className="mt-6">
            <div className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-3">Required Skills</div>
            <div className="flex flex-wrap gap-2">
              {parsedData.requiredSkills?.map((skill, i) => (
                <span key={i} className="px-3 py-1.5 bg-pink-50 dark:bg-pink-500/10 text-pink-600 dark:text-pink-400 rounded-full text-sm font-medium flex items-center">
                  <Check size={14} className="mr-1" /> {skill}
                </span>
              ))}
            </div>
          </div>

          <div className="mt-8 pt-6 border-t border-slate-200 dark:border-slate-800 flex justify-end">
             <button
              onClick={handleMatch}
              disabled={matching}
              className="px-6 py-3 bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-slate-100 rounded-xl font-medium shadow-xl transition-all flex items-center"
            >
               {matching ? 'Matching...' : 'Find Matches'} <ArrowRight size={18} className="ml-2" />
            </button>
          </div>
        </motion.div>
      )}
    </div>
  );
}
