import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { Terminal, LogOut, Briefcase, User } from 'lucide-react';

const TopNav = ({ user, userRole, onLogout }) => {
  const navigate = useNavigate();

  return (
    <nav className="navbar">
      <div className="flex items-center gap-3 cursor-pointer" onClick={() => navigate('/')}>
        <div className="w-10 h-10 bg-accent-primary rounded-xl flex items-center justify-center shadow-lg shadow-accent-glow">
          <Terminal size={20} color="white" />
        </div>
        <span className="font-bold text-xl tracking-tight">HireAI <span className="text-accent-primary">{userRole === 'candidate' ? 'Talent' : 'Platform'}</span></span>
      </div>
      
      <div className="flex-grow flex justify-center gap-8">
        <NavLink 
          to="/jobs" 
          className={({ isActive }) => `text-sm font-semibold transition-all ${isActive ? 'text-accent-primary' : 'text-text-secondary hover:text-white'}`}
        >
          Explore Jobs
        </NavLink>

        {user && userRole === 'candidate' && (
          <NavLink 
            to="/talent/dashboard" 
            className={({ isActive }) => `text-sm font-semibold transition-all ${isActive ? 'text-accent-primary' : 'text-text-secondary hover:text-white'}`}
          >
            My Applications
          </NavLink>
        )}
      </div>

      <div className="flex items-center gap-4">
        {user ? (
          <>
            <div className="flex items-center gap-3 px-3 py-1.5 rounded-full bg-white/5 border border-white/5">
                <div className="w-7 h-7 rounded-full bg-accent-primary flex items-center justify-center text-white text-[10px] font-bold uppercase">
                   {(user.full_name || user.user_metadata?.full_name || user.email)?.[0].toUpperCase() || 'U'}
                </div>
                <span className="text-xs font-medium text-text-secondary hidden sm:block">
                  {user.full_name || user.user_metadata?.full_name || user.email}
                </span>
            </div>
            <button 
              className="p-2 text-text-muted hover:text-error transition-colors bg-white/5 rounded-lg border border-white/5"
              onClick={onLogout}
              title="Sign Out"
            >
              <LogOut size={18} />
            </button>
          </>
        ) : (
          <button 
            className="btn-primary py-2 px-6 text-sm"
            onClick={() => navigate('/')}
          >
            Sign In
          </button>
        )}
      </div>
    </nav>
  );
};

export default TopNav;
