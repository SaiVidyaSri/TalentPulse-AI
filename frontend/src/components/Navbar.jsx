import { Link, useLocation } from 'react-router-dom';
import { Moon, Sun, Briefcase, Users, LayoutDashboard } from 'lucide-react';

export default function Navbar({ darkMode, setDarkMode }) {
  const location = useLocation();

  const navItems = [
    { path: '/', label: 'Dashboard', icon: LayoutDashboard },
    { path: '/job-input', label: 'Post Job', icon: Briefcase },
    { path: '/ranking/latest', label: 'Candidates', icon: Users },
    { path: '/shortlist/latest', label: 'Executive Shortlist', icon: Users },
  ];

  return (
    <nav className="sticky top-0 z-50 w-full backdrop-blur-lg bg-white/70 dark:bg-slate-900/70 border-b border-slate-200 dark:border-slate-800">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        <Link to="/" className="flex items-center space-x-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-indigo-500 to-purple-500 flex items-center justify-center">
            <span className="text-white font-bold text-xl">T</span>
          </div>
          <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-500 to-purple-500">
            TalentPulse AI
          </span>
        </Link>

        <div className="flex items-center space-x-6">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center space-x-1 px-3 py-2 rounded-md transition-colors ${
                  isActive 
                    ? 'bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400' 
                    : 'text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                }`}
              >
                <Icon size={18} />
                <span className="font-medium">{item.label}</span>
              </Link>
            );
          })}
          
          <button
            onClick={() => setDarkMode(!darkMode)}
            className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-slate-600 dark:text-slate-300"
          >
            {darkMode ? <Sun size={20} /> : <Moon size={20} />}
          </button>
        </div>
      </div>
    </nav>
  );
}
