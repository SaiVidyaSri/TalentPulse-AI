import { useState, useEffect } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend } from 'recharts';
import { Award, CheckCircle, Download, TrendingUp } from 'lucide-react';
import axios from 'axios';

function ScoreTooltip({ active, payload }) {
  if (!active || !payload || !payload.length) return null;
  const point = payload[0]?.payload;
  if (!point) return null;

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white/95 dark:bg-slate-900/95 shadow-xl px-3 py-2 min-w-[210px]">
      <div className="text-sm font-bold text-slate-900 dark:text-white mb-1">{point.name}</div>
      <div className="text-xs text-slate-600 dark:text-slate-300">Match: {point.matchScore}%</div>
      <div className="text-xs text-slate-600 dark:text-slate-300">Interest: {point.interestScore}%</div>
      <div className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 mt-1">Final Score: {point.finalScore}</div>
    </div>
  );
}

export default function ExecutiveShortlist() {
  const { campaignId } = useParams();
  const [searchParams] = useSearchParams();
  const [candidates, setCandidates] = useState([]);
  const [campaignDetails, setCampaignDetails] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    const fetchResults = async () => {
      try {
        const res = await axios.get(`http://localhost:5000/api/campaigns/${campaignId}/results`);
        setCandidates(res.data.candidates);
        setCampaignDetails(res.data.campaignDetails);
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    };
    if (campaignId) fetchResults();
  }, [campaignId]);

  if (loading) {
    return <div className="flex justify-center items-center h-[60vh]"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div></div>;
  }

  const topCountParam = Number(searchParams.get('top'));
  const finalizedCount = Number.isFinite(topCountParam) && topCountParam > 0
    ? Math.min(topCountParam, candidates.length)
    : Math.min(10, candidates.length);
  const finalizedCandidates = candidates.slice(0, finalizedCount);
  const engagedFinalizedCandidates = finalizedCandidates.filter((c) => c.status === 'Engaged');

  // Plot only finalized shortlist candidates.
  const clampScore = (score) => Math.max(0, Math.min(100, Number(score) || 0));
  const barData = finalizedCandidates.map((c) => {
    const shortName = String(c.name || 'Candidate').split(' ').slice(0, 2).join(' ');
    const finalScore = Number(c.finalScore ?? c.matchScore ?? 0);

    return {
      id: c._id,
      name: c.name,
      shortName,
      status: c.status,
      matchScore: clampScore(c.matchScore),
      interestScore: clampScore(c.interestScore),
      finalScore
    };
  });

  const handleExportReport = async () => {
    if (!campaignId || isExporting) return;

    try {
      setIsExporting(true);
      const scope = 'all';
      const response = await axios.get(`http://localhost:5000/api/campaigns/${campaignId}/export-excel?scope=${scope}&top=${finalizedCount}`, {
        responseType: 'blob'
      });

      const contentDisposition = response.headers['content-disposition'] || '';
      const filenameMatch = contentDisposition.match(/filename="?([^";]+)"?/i);
      const downloadName = filenameMatch?.[1] || `campaign_${scope}_report.xlsx`;

      const blob = new Blob([response.data], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', downloadName);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error exporting report:', error);
      window.alert('Failed to export Excel report. Please try again.');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-pink-500">
            Executive Shortlist: {campaignDetails?.title || 'Candidates'}
          </h1>
          <p className="text-slate-600 dark:text-slate-400 mt-2 max-w-2xl">
            Finalized talent recommendations based on multidimensional AI analysis of technical skills, experience alignment, and simulated engagement interest.
          </p>
        </div>
        <button
          onClick={handleExportReport}
          disabled={isExporting}
          className="px-5 py-2.5 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-xl font-medium shadow-lg hover:shadow-xl transition-all flex items-center disabled:opacity-60 disabled:cursor-not-allowed"
        >
          <Download size={18} className="mr-2" /> {isExporting ? 'Exporting...' : 'Export Report'}
        </button>
      </div>

      {/* Analytics Dashboard */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="glass dark:glass-dark rounded-2xl p-6 flex flex-col">
          <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-6 flex items-center">
            <TrendingUp className="mr-2 text-indigo-500" /> Match & Interest Comparison
          </h2>
          <p className="text-xs text-slate-500 mb-4">Each bar represents a finalized candidate. Hover to see name and score details.</p>
          <div className="flex-1 min-h-[300px] min-w-0">
            {barData.length > 0 ? (
              <div className="h-[320px] w-full min-w-0">
                <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                  <BarChart data={barData} layout="vertical" margin={{ top: 10, right: 20, bottom: 10, left: 20 }} barCategoryGap={12}>
                    <XAxis type="number" stroke="#888888" domain={[0, 100]} tickFormatter={(value) => `${value}%`} />
                    <YAxis type="category" dataKey="shortName" stroke="#888888" width={120} />
                    <Tooltip
                      cursor={{ fill: 'rgba(99, 102, 241, 0.08)' }}
                      content={<ScoreTooltip />}
                    />
                    <Legend />
                    <Bar dataKey="matchScore" name="Match Score" fill="#6366f1" radius={[0, 6, 6, 0]} barSize={12} />
                    <Bar dataKey="interestScore" name="Interest Score" fill="#ec4899" radius={[0, 6, 6, 0]} barSize={12} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-[320px] w-full flex items-center justify-center text-sm text-slate-500 bg-slate-50/60 dark:bg-slate-900/40 rounded-xl border border-slate-200 dark:border-slate-700/50">
                No finalized candidates to plot on the matrix.
              </div>
            )}
          </div>
        </div>

        <div className="glass dark:glass-dark rounded-2xl p-6 flex flex-col">
           <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-6">Pipeline Overview</h2>
           <div className="grid grid-cols-2 gap-4 flex-1">
             <div className="bg-gradient-to-br from-indigo-500/10 to-purple-500/10 border border-indigo-500/20 rounded-xl p-6 flex flex-col justify-center items-center text-center">
               <Award className="w-10 h-10 text-indigo-500 mb-2" />
               <div className="text-3xl font-bold text-slate-900 dark:text-white">{finalizedCandidates.length}</div>
               <div className="text-sm font-medium text-slate-500 mt-1">Finalized Candidates</div>
             </div>
             <div className="bg-gradient-to-br from-slate-500/10 to-slate-400/10 border border-slate-500/20 rounded-xl p-6 flex flex-col justify-center items-center text-center">
               <CheckCircle className="w-10 h-10 text-emerald-500 mb-2" />
               <div className="text-3xl font-bold text-slate-900 dark:text-white">{engagedFinalizedCandidates.length}</div>
               <div className="text-sm font-medium text-slate-500 mt-1">Engaged Finalists</div>
             </div>
           </div>
        </div>
      </div>

      {/* Candidate List */}
      <div className="space-y-6">
        {finalizedCandidates.map((candidate, idx) => (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.1 }}
            key={candidate._id} 
            className="glass dark:glass-dark rounded-2xl p-6 border-l-4 border-indigo-500"
          >
            <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
              <div className="flex items-start space-x-4 flex-1">
                <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-indigo-500 to-pink-500 flex items-center justify-center text-white text-2xl font-bold shadow-lg shrink-0">
                  {candidate.name.charAt(0)}
                </div>
                <div>
                  <h3 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center">
                    {candidate.name}
                    {candidate.status === 'Engaged' && <CheckCircle className="w-5 h-5 ml-2 text-green-500" />}
                  </h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{candidate.location} • {candidate.experience} years exp</p>
                  
                  <div className="flex flex-wrap gap-2 mt-4">
                    {candidate.skills.map((skill, i) => (
                      <span key={i} className="px-2.5 py-1 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded text-xs font-medium">
                        {skill}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex gap-4 md:flex-col lg:flex-row shrink-0">
                <div className="bg-indigo-50 dark:bg-indigo-900/20 px-4 py-3 rounded-xl border border-indigo-100 dark:border-indigo-800/50 text-center min-w-[100px]">
                  <div className="text-xs font-bold text-indigo-400 uppercase tracking-wider mb-1">Match</div>
                  <div className="text-2xl font-extrabold text-indigo-600 dark:text-indigo-400">{candidate.matchScore}%</div>
                </div>
                <div className="bg-pink-50 dark:bg-pink-900/20 px-4 py-3 rounded-xl border border-pink-100 dark:border-pink-800/50 text-center min-w-[100px]">
                  <div className="text-xs font-bold text-pink-400 uppercase tracking-wider mb-1">Interest</div>
                  <div className="text-2xl font-extrabold text-pink-600 dark:text-pink-400">{candidate.interestScore}%</div>
                </div>
                <div className="bg-emerald-50 dark:bg-emerald-900/20 px-4 py-3 rounded-xl border border-emerald-100 dark:border-emerald-800/50 text-center min-w-[110px]">
                  <div className="text-xs font-bold text-emerald-500 uppercase tracking-wider mb-1">Final Score</div>
                  <div className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400">{candidate.finalScore}</div>
                </div>
              </div>
            </div>

            <div className="mt-6 pt-5 border-t border-slate-200 dark:border-slate-700/50">
              <h4 className="text-sm font-bold text-slate-900 dark:text-white mb-2 flex items-center">
                <SparklesIcon /> AI Explanatory Summary
              </h4>
              <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed bg-white/50 dark:bg-slate-900/50 p-4 rounded-xl">
                {candidate.aiSummary || candidate.explanation || 'Summary unavailable.'}
              </p>
            </div>
          </motion.div>
        ))}
        
        {finalizedCandidates.length === 0 && (
          <div className="text-center py-12 text-slate-500">
            No candidates in this category.
          </div>
        )}
      </div>
    </div>
  );
}

function SparklesIcon() {
  return (
    <svg className="w-4 h-4 text-yellow-500 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
    </svg>
  );
}
