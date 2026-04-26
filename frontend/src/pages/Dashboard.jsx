import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { Users, Target, Star, TrendingUp } from 'lucide-react';
import axios from 'axios';
import { buildApiUrl } from '../utils/api';
import CandidateCard from '../components/CandidateCard';

const COLORS = ['#6366f1', '#ec4899', '#06b6d4', '#f59e0b'];

export default function Dashboard() {
  const [candidates, setCandidates] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchCandidates = async () => {
      try {
        const res = await axios.get(buildApiUrl('/campaigns/latest/results'));
        setCandidates(res.data.candidates || []);
      } catch (error) {
        console.error('Error fetching candidates:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchCandidates();
  }, []);

  if (loading) {
    return <div className="flex justify-center items-center h-[60vh]"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div></div>;
  }

  const topCandidate = candidates[0];
  const avgMatchScore = candidates.length > 0 
    ? Math.round(candidates.reduce((acc, c) => acc + c.matchScore, 0) / candidates.length)
    : 0;

  const chartData = candidates.slice(0, 5).map(c => ({
    name: c.name.split(' ')[0],
    Score: c.finalScore || c.matchScore
  }));

  const skillCount = {};
  candidates.forEach(c => {
    c.skills.forEach(s => {
      skillCount[s] = (skillCount[s] || 0) + 1;
    });
  });
  
  const pieData = Object.keys(skillCount).map(k => ({ name: k, value: skillCount[k] })).sort((a,b) => b.value - a.value).slice(0,4);

  const stats = [
    { title: 'Total Candidates', value: candidates.length, icon: Users, color: 'text-indigo-500' },
    { title: 'Avg Match Score', value: `${avgMatchScore}%`, icon: Target, color: 'text-pink-500' },
    { title: 'Top Performer', value: topCandidate ? topCandidate.name : 'N/A', icon: Star, color: 'text-yellow-500' },
    { title: 'Processing AI', value: 'Active', icon: TrendingUp, color: 'text-cyan-500' },
  ];

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Dashboard Overview</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">Real-time talent scouting metrics.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="glass dark:glass-dark rounded-xl p-6 flex items-center space-x-4"
          >
            <div className={`p-3 rounded-lg bg-slate-100 dark:bg-slate-800 ${stat.color}`}>
              <stat.icon size={24} />
            </div>
            <div>
              <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">{stat.title}</p>
              <h3 className="text-2xl font-bold text-slate-900 dark:text-white">{stat.value}</h3>
            </div>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 glass dark:glass-dark rounded-xl p-6">
          <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-6">Top Candidates Scores</h2>
          <div className="h-96 min-w-0">
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                <BarChart data={chartData}>
                  <XAxis dataKey="name" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="#888888" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `${value}%`} />
                  <Tooltip cursor={{fill: 'rgba(99, 102, 241, 0.1)'}} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                  <Bar dataKey="Score" fill="#6366f1" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full w-full flex items-center justify-center text-sm text-slate-500 bg-slate-50/60 dark:bg-slate-900/40 rounded-xl border border-slate-200 dark:border-slate-700/50">
                No candidate score data available yet.
              </div>
            )}
          </div>
        </div>

        <div className="glass dark:glass-dark rounded-xl p-6 flex flex-col">
          <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-6">Popular Skills Pool</h2>
          <div className="flex-1 min-h-[24rem]">
            {pieData.length > 0 ? (
              <div className="h-[300px] w-full min-w-0">
                <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-[300px] w-full flex items-center justify-center text-sm text-slate-500 bg-slate-50/60 dark:bg-slate-900/40 rounded-xl border border-slate-200 dark:border-slate-700/50">
                No skill distribution data available yet.
              </div>
            )}
            <div className="flex flex-wrap justify-center gap-4 mt-6 pb-2">
              {pieData.map((entry, index) => (
                <div key={index} className="flex items-center text-sm">
                  <span className="w-3 h-3 rounded-full mr-2" style={{ backgroundColor: COLORS[index % COLORS.length] }}></span>
                  <span className="text-slate-600 dark:text-slate-300">{entry.name}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {topCandidate && (
        <div className="mt-8">
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-6">Top Recommended Candidate</h2>
          <div className="max-w-2xl">
            <CandidateCard candidate={topCandidate} />
          </div>
        </div>
      )}
    </div>
  );
}
