import { motion } from 'framer-motion';
import { User, Briefcase, MapPin, CheckCircle } from 'lucide-react';

export default function CandidateCard({ candidate, onClick }) {
  const matchScore = candidate.matchScore || 0;
  const interestScore = candidate.interestScore || 0;
  
  return (
    <motion.div
      whileHover={{ y: -5 }}
      onClick={onClick}
      className={`glass dark:glass-dark rounded-xl p-6 ${onClick ? 'cursor-pointer hover:border-indigo-500/50' : ''} transition-all`}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center space-x-4">
          <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-cyan-500 to-blue-500 flex items-center justify-center text-white text-2xl font-bold shadow-lg">
            {candidate.name.charAt(0)}
          </div>
          <div>
            <h3 className="text-xl font-bold text-slate-900 dark:text-white">{candidate.name}</h3>
            <div className="flex items-center space-x-3 text-sm text-slate-500 dark:text-slate-400 mt-1">
              <span className="flex items-center"><Briefcase size={14} className="mr-1"/> {candidate.experience} yrs</span>
              <span className="flex items-center"><MapPin size={14} className="mr-1"/> {candidate.location}</span>
            </div>
          </div>
        </div>
        
        <div className="text-right">
          <div className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-1">Match Score</div>
          <div className="flex items-center justify-end space-x-2">
            <div className="w-24 bg-slate-200 dark:bg-slate-700 rounded-full h-2.5 overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${matchScore}%` }}
                transition={{ duration: 1, ease: "easeOut" }}
                className="bg-gradient-to-r from-indigo-500 to-purple-500 h-2.5 rounded-full"
              ></motion.div>
            </div>
            <span className="font-bold text-indigo-600 dark:text-indigo-400">{matchScore}%</span>
          </div>
        </div>
      </div>

      <div className="mt-6">
        <div className="flex flex-wrap gap-2">
          {candidate.skills.map((skill, i) => (
            <span key={i} className="px-3 py-1 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded-full text-xs font-semibold border border-indigo-100 dark:border-indigo-500/20">
              {skill}
            </span>
          ))}
        </div>
      </div>

      <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center">
        <div className="flex-1">
          <p className="text-sm text-slate-600 dark:text-slate-300 flex items-start">
            <CheckCircle size={16} className="text-green-500 mr-2 mt-0.5 shrink-0" />
            <span>{candidate.explanation || "Ready to be analyzed."}</span>
          </p>
        </div>
        <div className="ml-4 text-center shrink-0">
          <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Interest</div>
          <div className="text-lg font-bold text-pink-500">{interestScore}/100</div>
        </div>
      </div>
    </motion.div>
  );
}
