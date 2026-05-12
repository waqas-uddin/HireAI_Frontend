import React, { useState, useEffect } from 'react';
import { Plus, Users, Briefcase, ChevronRight, Search, Sparkles, CheckCircle, Clock, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { dbService } from '../services/dbService';
import { supabase } from '../lib/supabase';
import { calculateFinalScore } from '../utils/scoring';

const Dashboard = ({ user }) => {
  const navigate = useNavigate();
  const [jobs, setJobs] = useState([]);
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedJobId, setSelectedJobId] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  // Subscribe to applications changes so the Applicant Queue updates in realtime
  useEffect(() => {
    const channel = supabase
      .channel('public-applications')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'applications' }, (payload) => {
        // Reload data when applications change (status updates, new applications, etc.)
        loadData();
      })
      .subscribe();

    return () => {
      try { channel.unsubscribe(); } catch (e) { /* ignore */ }
    };
  }, []);

  const loadData = async () => {
    try {
      const [jobsData, appsData] = await Promise.all([
        dbService.getJobs(user?.id),
        dbService.getAllApplications(user?.id)
      ]);
      setJobs(jobsData);
      setApplications(appsData);
    } catch (err) {
      console.error("Data load failed", err);
    } finally {
      setLoading(false);
    }
  };

  const handleInvite = async (appId) => {
    try {
        await dbService.updateApplicationStatus(appId, 'invited');
        loadData();
    } catch (err) {
        alert("Action failed: " + err.message);
    }
  };

  const handleDeleteJob = async (e, jobId) => {
    e.stopPropagation();
    if (!window.confirm("Are you sure you want to delete this job node? All associated applicant data will be preserved but the listing will be removed.")) return;
    
    try {
        await dbService.deleteJob(jobId);
        if (selectedJobId === jobId) setSelectedJobId(null);
        loadData();
    } catch (err) {
        alert("Delete failed: " + err.message);
    }
  };

  const jobApps = applications.filter(app => app.job_id === selectedJobId);
  const totalInvited = applications.filter(a => a.status === 'invited').length;

  const renderQueueStatus = (app) => {
    if (app.status === 'pending') {
      return (
        <button
          className="btn-primary py-2.5 px-8 text-[11px] font-black uppercase tracking-widest transition-all"
          onClick={() => handleInvite(app.id)}
        >
          Review & Invite
        </button>
      );
    }

    if (app.status === 'completed') {
      return (
        <div className="flex items-center gap-2 text-success px-4 py-2 bg-success/5 border border-success/10 rounded-xl text-[10px] font-black uppercase tracking-widest">
          <CheckCircle size={14} /> Interview Completed
        </div>
      );
    }

    return (
      <div className="flex items-center gap-2 text-accent-primary px-4 py-2 bg-accent-glow border border-accent-primary/20 rounded-xl text-[10px] font-black uppercase tracking-widest">
        <CheckCircle size={14} /> Pipeline Invited
      </div>
    );
  };

  return (
    <div className="manager-main max-w-7xl mx-auto px-6">
      <header className="flex justify-between items-end mb-10">
        <div>
           <h1 className="text-4xl font-black tracking-tight text-white mb-1">
             Recruiter <span className="text-accent-primary">Dashboard.</span>
           </h1>
           <p className="text-text-muted text-sm font-medium">Welcome back, {user?.full_name || user?.email?.split('@')[0]}. Manage your hiring pipeline.</p>
        </div>
        <button className="btn-primary flex items-center gap-2" onClick={() => navigate('/manager/jobs/create')}>
          <Plus size={20} /> 
          <span>Post a Job</span>
        </button>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
        <StatCard title="Active Jobs" value={jobs.length} icon={<Briefcase size={22} />} trend="+12%" />
        <StatCard title="Applicants" value={applications.length} icon={<Users size={22} />} trend="+5%" />
        <StatCard title="Interviews" value={totalInvited} icon={<Sparkles size={22} />} trend="Global" />
      </div>

      <div className="flex flex-col gap-12">
        
        {/* Section 1: Manage Jobs (Upper) */}
        <div className="flex flex-col">
           <div className="flex items-center justify-between mb-8 px-2">
              <h3 className="text-2xl font-black text-white tracking-tight uppercase">Manage Jobs</h3>
              <span className="text-[10px] font-black text-text-muted uppercase tracking-[0.2em]">{jobs.length} total nodes</span>
           </div>
           
           <div className="flex flex-col gap-4">
            {jobs.map((job) => (
                <div 
                    key={job.id} 
                    className={`card glass p-6 cursor-pointer transition-all border-l-4 flex flex-col md:flex-row md:items-center justify-between gap-4 ${selectedJobId === job.id ? 'border-accent-primary bg-accent-primary/10' : 'border-transparent hover:border-white/10'}`}
                    onClick={() => setSelectedJobId(job.id)}
                >
                    <div className="flex flex-col flex-1">
                        <div className="flex flex-wrap items-center gap-3 mb-2">
                            <h4 className="font-bold text-white text-lg tracking-tight">{job.title}</h4>
                        </div>
                        <p className="text-xs text-text-secondary line-clamp-1 opacity-70 leading-relaxed max-w-2xl">{job.description}</p>
                    </div>
                    
                    <div className="flex items-center justify-between md:justify-end gap-6 w-full md:w-auto mt-4 md:mt-0 pt-4 md:pt-0 border-t border-white/5 md:border-none">
                        <span className="text-[10px] font-bold text-text-muted uppercase tracking-[0.15em] shrink-0">
                            {applications.filter(a => a.job_id === job.id).length} Applicants
                        </span>
                        <div className="flex items-center gap-4">
                            <span 
                                className="font-black text-accent-primary bg-accent-glow px-3 py-1.5 rounded-full uppercase tracking-widest border border-accent-primary/20 whitespace-nowrap"
                                style={{ fontSize: '10px' }}
                            >
                                {job.domain}
                            </span>
                            <button 
                                onClick={(e) => handleDeleteJob(e, job.id)}
                                className="p-2 text-text-muted flex items-center justify-center cursor-pointer transition-colors rounded-full"
                                style={{ background: 'transparent', border: 'none', outline: 'none' }}
                                title="Delete Job"
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.color = '#ef4444'; 
                                    e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.1)';
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.color = ''; 
                                    e.currentTarget.style.backgroundColor = 'transparent';
                                }}
                            >
                                <Trash2 size={16} />
                            </button>
                        </div>
                    </div>
                </div>
            ))}
           </div>
        </div>

        {/* Section 2: Applicant Queue (Lower) */}
        <div className="flex flex-col">
           <div className="flex items-center justify-between mb-8 px-2">
              <h3 className="text-2xl font-black text-white tracking-tight uppercase">Applicant Queue</h3>
              {selectedJobId && <span className="text-[10px] font-black text-accent-primary bg-accent-glow px-3 py-1.5 rounded-lg uppercase tracking-widest border border-accent-primary/10">{jobApps.length} Candidates for Selected Role</span>}
           </div>

           <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {!selectedJobId ? (
                <div className="col-span-full py-12 px-6 flex items-center justify-center text-center opacity-60">
                    <p className="text-text-muted text-sm font-bold tracking-widest uppercase">Click on a Job above to view its Applicant Queue</p>
                </div>
              ) : jobApps.length === 0 ? (
                <div className="col-span-full py-12 px-6 flex items-center justify-center text-center">
                    <p className="text-text-muted text-sm italic font-medium">No candidates have applied to this role yet.</p>
                </div>
              ) : (
                jobApps.map((app) => (
                    <motion.div 
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        key={app.id} 
                        className="card glass p-8 hover:border-white/20 transition-all border border-white/5"
                    >
                        <div className="flex justify-between items-start mb-6 pb-6 border-b border-white/5">
                            <div className="flex gap-4 items-center">
                                <div className="w-12 h-12 rounded-full bg-accent-primary flex items-center justify-center text-white font-black text-sm shadow-inner uppercase">
                                    {app.profiles?.full_name?.[0] || app.candidate_email[0].toUpperCase()}
                                </div>
                                <div>
                                    <h4 className="font-bold text-xl text-white mb-1 tracking-tight">{app.profiles?.full_name || app.candidate_email}</h4>
                                    <div className="flex items-center gap-2 text-[10px] text-text-muted uppercase tracking-widest font-black">
                                        <Clock size={12} /> Received {new Date(app.created_at).toLocaleDateString()}
                                    </div>
                                </div>
                            </div>
                            <div className="text-right">
                              <span className="text-[10px] text-text-muted uppercase font-black tracking-widest block mb-1">
                                {app.status === 'completed' ? 'Combined Performance' : 'AI Rating'}
                              </span>
                              <div className={`text-4xl font-black tracking-tighter ${calculateFinalScore(app.resume_score, app.coding_score, app.verbal_score) > 70 ? 'text-success' : 'text-warning'}`}>
                                {calculateFinalScore(app.resume_score, app.coding_score, app.verbal_score)}%
                              </div>
                            </div>
                        </div>
                        
                        <p className="text-sm text-text-secondary leading-relaxed bg-black/40 p-5 rounded-2xl border border-white/5 italic mb-8">
                            "{app.reasoning}"
                        </p>

                        <div className="flex justify-between items-center bg-white/[0.02] p-4 rounded-xl border border-white/5">
                            <span className="text-[10px] font-black text-text-muted uppercase tracking-[0.2em]">Operational Status</span>
                            {renderQueueStatus(app)}
                        </div>
                    </motion.div>
                ))
              )}
           </div>
        </div>

      </div>
    </div>
  );
};

const StatCard = ({ title, value, icon, trend }) => (
  <div className="card glass p-8 flex flex-col gap-6 group hover:border-accent-primary/40 transition-all">
    <div className="flex justify-between items-center">
      <div className="w-14 h-14 bg-bg-secondary border border-border-color rounded-2xl flex items-center justify-center text-text-secondary group-hover:bg-accent-primary group-hover:text-white transition-all">
        {icon}
      </div>
      <span className="text-[10px] font-black text-success bg-success/10 px-3 py-1.5 rounded-full border border-success/20 tracking-widest">{trend}</span>
    </div>
    <div>
      <p className="text-[10px] uppercase tracking-[0.3em] font-black text-text-muted mb-2">{title}</p>
      <h3 className="text-4xl font-black text-white">{value}</h3>
    </div>
  </div>
);

export default Dashboard;
