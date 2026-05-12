import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Briefcase, Clock, FileText, ChevronRight, Play, CheckCircle2, Lock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { dbService } from '../services/dbService';

const CandidateDashboard = ({ user }) => {
  const navigate = useNavigate();
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user?.email) loadApplications();
  }, [user]);

  const loadApplications = async () => {
    try {
      const data = await dbService.getCandidateApplications(user.email);
      setApplications(data);
    } catch (err) {
      console.error("Load failed", err);
    } finally {
      setLoading(false);
    }
  };

  const getStatusInfo = (status) => {
    switch (status?.toLowerCase()) {
      case 'completed': return { label: 'Interview Finished', color: 'text-success bg-success/10 border-success/20', icon: <CheckCircle2 size={12} /> };
      case 'invited': return { label: 'Invite Received', color: 'text-accent-primary bg-accent-glow border-accent-primary/20 animate-pulse', icon: <Sparkles size={12} /> };
      case 'rejected': return { label: 'Not Selected', color: 'text-error bg-error/10 border-error/20', icon: <FileText size={12} /> };
      case 'pending': return { label: 'Under Review', color: 'text-warning bg-warning/10 border-warning/20', icon: <Clock size={12} /> };
      default: return { label: 'Screening', color: 'text-text-muted bg-white/5 border-white/10', icon: <Briefcase size={12} /> };
    }
  };

  return (
    <div className="page-container">
      <header className="mb-16">
        <h1 className="text-5xl font-bold mb-4 tracking-tight">
          Welcome, <span className="text-accent-primary">{user?.full_name?.split(' ')[0] || user?.email?.split('@')[0]}</span>.
        </h1>
        <p className="text-text-secondary text-lg">
          Synchronizing with Active Jobs. Track your progress across the HireAI ecosystem.
        </p>
      </header>

      {loading ? (
        <div className="space-y-6">
            {[1,2].map(i => <div key={i} className="card h-24 animate-pulse bg-white/5 rounded-3xl" />)}
        </div>
      ) : applications.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center py-20">
            <div className="card glass p-12 py-16 text-center flex flex-col items-center gap-6 border-dashed border-2 border-border-color max-w-2xl w-full">
               <div className="w-20 h-20 bg-white/5 rounded-3xl flex items-center justify-center text-text-muted">
                  <Briefcase size={32} />
               </div>
               <div>
                  <h3 className="text-2xl font-bold mb-2 text-white text-center">No active Jobs</h3>
                  <p className="text-text-secondary max-w-sm mx-auto text-center">You haven't applied to any roles yet. Explore open roles to begin.</p>
               </div>
               <button className="btn-primary" onClick={() => navigate('/jobs')}>Explore Open Roles</button>
            </div>
        </div>
      ) : (
        <div className="space-y-6">
          <AnimatePresence>
            {applications.map((app, idx) => {
              const status = getStatusInfo(app.status);
              const job = app.jobs; // From Supabase join
              
              return (
                <motion.div 
                  key={app.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.1 }}
                  className="card glass p-8 flex flex-col lg:flex-row items-center justify-between gap-8 hover:border-accent-primary/50 transition-all group"
                >
                  <div className="flex items-center gap-8 w-full lg:w-auto">
                    <div className="w-16 h-16 bg-accent-glow rounded-3xl flex items-center justify-center text-accent-primary border border-accent-primary/20 group-hover:scale-105 transition-transform duration-500">
                      <Briefcase size={28} />
                    </div>
                    <div>
                      <h3 className="text-2xl font-bold mb-1 text-white">{job?.title || 'Unknown Role'}</h3>
                      <div className="flex flex-wrap items-center gap-4 text-xs">
                         <span className="text-accent-primary font-bold uppercase tracking-[0.2em]">{job?.domain}</span>
                         <span className="text-text-muted flex items-center gap-1">
                            <Clock size={12} /> Applied {new Date(app.created_at).toLocaleDateString()}
                         </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row items-center gap-8 w-full lg:w-auto justify-between lg:justify-end">
                    <div className={`status-chip flex items-center gap-2 ${status.color}`}>
                      {status.icon}
                      {status.label}
                    </div>
                    
                    <div className="flex gap-3">
                        {app.status === 'invited' ? (
                            <button 
                                className="btn-primary py-3 px-8 text-sm animate-pulse-slow"
                                onClick={() => navigate(`/interview/${app.job_id}`, { 
                                  state: { 
                                    job, 
                                    resumeText: app.resume_text || '',
                                    applicationId: app.id
                                  } 
                                })}
                            >
                                <Play size={16} fill="currentColor" /> Start Interview
                            </button>
                        ) : app.status === 'completed' ? (
                            <button 
                                className="btn-outline py-3 px-8 text-sm flex items-center gap-2"
                                onClick={() => navigate(`/report/${app.job_id}`)}
                            >
                                <FileText size={16} /> View Performance
                            </button>
                        ) : (
                            <div className="flex items-center gap-3 px-6 py-3 rounded-2xl bg-white/5 border border-white/5 text-text-muted text-xs font-bold uppercase tracking-widest cursor-not-allowed">
                                <Lock size={14} /> Locked
                            </div>
                        )}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
};

// Global Animation for invited status
const Sparkles = ({ size }) => (
    <motion.div animate={{ opacity: [1, 0.5, 1], scale: [1, 1.1, 1] }} transition={{ repeat: Infinity, duration: 1.5 }}>
        <CheckCircle2 size={size} />
    </motion.div>
);

export default CandidateDashboard;
