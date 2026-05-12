import React from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Briefcase, Globe, LogOut, Terminal, User } from 'lucide-react';

const Sidebar = ({ user, userRole, onLogout }) => {
  const isCandidate = userRole === 'candidate';

  return (
    <aside className="sidebar flex flex-col justify-between h-screen fixed">
      {/* Top Section */}
      <div className="w-full">
        <div className="flex items-center gap-4 mb-10 px-2">
          <div className="w-10 h-10 bg-accent-primary rounded-xl flex items-center justify-center shadow-lg">
            <Terminal size={20} color="white" />
          </div>
          <span className="font-bold text-xl tracking-tight text-white">HireAI</span>
        </div>

        <nav className="sidebar-nav space-y-2">
          {isCandidate ? (
            <>
              <NavLink 
                to="/jobs" 
                className={({ isActive }) => `sidebar-item flex items-center gap-4 ${isActive ? 'active' : ''}`}
              >
                <Globe size={18} />
                <span>Explore Jobs</span>
              </NavLink>
              <NavLink 
                to="/talent/dashboard" // Points to applications on dashboard
                className={({ isActive }) => `sidebar-item flex items-center gap-4 ${isActive ? 'active' : ''}`}
              >
                <Briefcase size={18} />
                <span>My Applications</span>
              </NavLink>
            </>
          ) : (
            <>
              <NavLink 
                to="/manager/dashboard" 
                className={({ isActive }) => `sidebar-item flex items-center gap-4 ${isActive ? 'active' : ''}`}
              >
                <LayoutDashboard size={18} />
                <span>Dashboard</span>
              </NavLink>
              <NavLink 
                to="/manager/jobs/create" 
                className={({ isActive }) => `sidebar-item flex items-center gap-4 ${isActive ? 'active' : ''}`}
              >
                <Briefcase size={18} />
                <span>Post a Job</span>
              </NavLink>
              <NavLink 
                to="/jobs" 
                className={({ isActive }) => `sidebar-item flex items-center gap-4 ${isActive ? 'active' : ''}`}
              >
                {/* <Globe size={18} />
                <span>Explore Jobs</span> */}
              </NavLink>
            </>
          )}
        </nav>
      </div>

      {/* Bottom Section - Guaranteed to be at the very bottom */}
      <div className="sidebar-footer w-full pb-4 space-y-4">
        <div className="flex items-center gap-3 p-4 bg-white/5 rounded-2xl border border-white/5 group hover:border-white/10 transition-all">
          <div className="w-10 h-10 rounded-full bg-accent-glow flex items-center justify-center text-accent-primary border border-accent-primary/20 flex-shrink-0">
            <User size={18} />
          </div>
          <div className="flex flex-col overflow-hidden">
            <span className="text-xs font-bold truncate text-white uppercase tracking-tight">{user?.email?.split('@')[0] || 'User'}</span>
            <span className="text-[10px] text-text-muted uppercase font-black tracking-widest">{isCandidate ? 'Candidate Portal' : 'Recruiter Portal'}</span>
          </div>
        </div>
        
        <button 
          className="w-full bg-white text-black hover:bg-white/90 transition-all flex items-center gap-3 py-4 px-6 justify-start rounded-2xl shadow-lg border-none"
          onClick={onLogout}
        >
          <LogOut size={18} className="text-black" />
          <span className="text-sm font-black uppercase tracking-tight">Sign Out</span>
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
