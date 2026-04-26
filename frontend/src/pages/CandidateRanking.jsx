import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import CandidateCard from '../components/CandidateCard';
import ChatSimulation from '../components/ChatSimulation';

export default function CandidateRanking() {
  const { campaignId } = useParams();
  const navigate = useNavigate();
  const [candidates, setCandidates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCandidate, setSelectedCandidate] = useState(null);
  const [isShortlistModalOpen, setIsShortlistModalOpen] = useState(false);
  const [shortlistCount, setShortlistCount] = useState(10);

  useEffect(() => {
    fetchCandidates();
  }, [campaignId]);

  const fetchCandidates = async () => {
    try {
      const res = await axios.get(`http://localhost:5000/api/campaigns/${campaignId}/results`);
      setCandidates(res.data.candidates);
    } catch (error) {
      console.error('Error fetching candidates:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleEngagementComplete = () => {
    fetchCandidates();
  };

  const openShortlistModal = () => {
    const suggestedCount = Math.min(Math.max(candidates.length ? 5 : 1, 1), Math.max(candidates.length, 1));
    setShortlistCount(suggestedCount);
    setIsShortlistModalOpen(true);
  };

  const handleFinalizeShortlist = () => {
    if (!candidates.length) return;
    const normalized = Math.min(Math.max(Number(shortlistCount) || 1, 1), candidates.length);
    setIsShortlistModalOpen(false);
    navigate(`/shortlist/${campaignId}?top=${normalized}`);
  };

  if (loading) {
    return <div className="flex justify-center items-center h-[60vh]"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div></div>;
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      <div className="lg:col-span-1 space-y-6">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Ranked Matches</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Based on Job Match & Interest Level</p>
          </div>
          <button 
            onClick={openShortlistModal}
            className="px-4 py-2 bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 text-white rounded-lg text-sm font-medium shadow-md transition-all"
          >
            Finalize Shortlist
          </button>
        </div>
        
        <div className="space-y-4 max-h-[calc(100vh-200px)] overflow-y-auto pr-2 custom-scrollbar">
          {candidates.map((candidate) => (
            <CandidateCard 
              key={candidate._id} 
              candidate={candidate} 
              onClick={() => setSelectedCandidate(candidate)}
            />
          ))}
          {candidates.length === 0 && (
            <div className="text-slate-500 dark:text-slate-400 text-center py-8">
              No candidates found. Post a job first.
            </div>
          )}
        </div>
      </div>

      <div className="lg:col-span-2">
        {selectedCandidate ? (
          <div className="glass dark:glass-dark rounded-2xl p-6 h-[calc(100vh-150px)] flex flex-col">
            <div className="mb-6 pb-4 border-b border-slate-200 dark:border-slate-800">
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">Engage with {selectedCandidate.name}</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">Simulate an AI chat to gauge interest.</p>
            </div>
            
            <div className="flex-1 overflow-hidden">
               <ChatSimulation candidate={selectedCandidate} campaignId={campaignId} onComplete={handleEngagementComplete} />
            </div>
          </div>
        ) : (
          <div className="glass dark:glass-dark rounded-2xl p-8 h-[calc(100vh-150px)] flex flex-col items-center justify-center text-center">
            <div className="w-20 h-20 bg-indigo-50 dark:bg-indigo-500/10 rounded-full flex items-center justify-center mb-4">
              <svg className="w-10 h-10 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </div>
            <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Select a Candidate</h3>
            <p className="text-slate-500 dark:text-slate-400 max-w-sm">
              Click on a candidate from the ranked list to start an AI-simulated engagement chat.
            </p>
          </div>
        )}
      </div>

      {isShortlistModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-2xl p-6">
            <h3 className="text-xl font-bold text-slate-900 dark:text-white">Finalize Shortlist</h3>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
              Choose how many candidates you want in the final shortlist. Only those candidates will be shown in the executive shortlist.
            </p>

            <div className="mt-5">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Number of finalists (1 to {Math.max(candidates.length, 1)})
              </label>
              <input
                type="number"
                min={1}
                max={Math.max(candidates.length, 1)}
                value={shortlistCount}
                onChange={(e) => setShortlistCount(e.target.value)}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white px-3 py-2 outline-none focus:ring-2 focus:ring-pink-500"
              />
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setIsShortlistModalOpen(false)}
                className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                onClick={handleFinalizeShortlist}
                className="px-4 py-2 rounded-lg bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 text-white font-medium"
              >
                Show Finalized
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
