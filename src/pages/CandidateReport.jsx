import React, { useState, useEffect } from 'react';
import { Award, Target, Zap, BookOpen, ChevronRight, CheckCircle2, TrendingUp, Sparkles, ArrowLeft } from 'lucide-react';
import { motion } from 'framer-motion';
import { useParams, useNavigate } from 'react-router-dom';
import { dbService } from '../services/dbService';
import { supabase } from '../lib/supabase';

const CandidateReport = () => {
  const { jobId } = useParams();
  const navigate = useNavigate();
  const [job, setJob] = useState(null);
  const [app, setApp] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadReportData();
  }, [jobId]);

  const loadReportData = async () => {
    try {
        const { data: { user } } = await supabase.auth.getUser();
        const jobs = await dbService.getJobs();
        const currentJob = jobs.find(j => j.id.toString() === jobId.toString());
        setJob(currentJob);

        if (user) {
          const { data: application } = await supabase
            .from('applications')
            .select('*')
            .eq('job_id', jobId)
            .eq('candidate_id', user.id)
            .single();
          setApp(application);
        }
    } catch (err) {
        console.error("Report load failed", err);
    } finally {
        setLoading(false);
    }
  };

  // Mock performance data - this would normally come from an AI Scoring Engine/Supabase
  const metrics = [
    { 
      label: "Resume & Profile", 
      score: app?.resume_score / 10 || 0, 
      color: "#3b82f6", 
      items: ["Experience Fit", "Skills Match", "Domain Relevance"] 
    },
    { 
      label: "Technical Coding", 
      score: app?.coding_score / 10 || 0, 
      color: "#8b5cf6", 
      items: ["Logic", "Complexity", "Syntax"] 
    },
    { 
      label: "Behavioral & Flow", 
      score: 7.5, // Placeholder for behavioral
      color: "#10b981", 
      items: ["Clarity", "Confidence", "Tone"] 
    }
  ];

  const finalScore = (
    ((app?.resume_score || 0) * 0.3) + 
    ((app?.coding_score || 0) * 0.5) + 
    (75 * 0.2) // Mocked behavioral score for now
  ).toFixed(1);

  if (loading) {
      return (
          <div className="h-screen flex items-center justify-center bg-bg-primary">
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-accent-primary"></div>
          </div>
      );
  }

  return (
    <div className="page-container w-full mx-auto">
      <header className="mb-12 relative flex flex-col items-center">
        <div className="w-full flex justify-start mb-4">
          <button 
            onClick={() => navigate('/talent/dashboard')} 
            className="btn-ghost flex items-center gap-2 text-xs pl-0"
          >
            <ArrowLeft size={14} /> Back to Dashboard
          </button>
        </div>

        <motion.div 
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="inline-block p-4 sm:p-6 rounded-3xl bg-accent-glow mb-6 sm:mb-8 border border-accent-primary/20 shadow-2xl shadow-accent-glow"
        >
          <Award size={48} className="text-accent-primary sm:w-16 sm:h-16" />
        </motion.div>
        
        <h1 className="text-4xl sm:text-6xl font-black mb-4 tracking-tight text-center">AI <span className="text-accent-primary">Evaluation.</span></h1>
        <div className="flex items-center gap-4 mb-8">
           <div className="px-6 py-2 bg-accent-primary rounded-full font-black text-xl shadow-lg shadow-accent-glow">
              Final Score: {finalScore}%
           </div>
        </div>
        <p className="text-text-secondary text-sm sm:text-lg max-w-2xl mx-auto leading-relaxed text-center">
          Performance metrics for <span className="text-white font-bold">{job?.title || 'Technical Role'}</span>. 
          Your coding logic and resume credibility have been synthesized.
        </p>
      </header>

      <main className="grid grid-cols-1 lg:grid-cols-2 gap-12">
        {/* Performance Overview */}
        <section className="col-span-full card glass p-6 sm:p-10 border-t-4 border-t-accent-primary bg-neural-gradient overflow-hidden">
          <h2 className="text-xl sm:text-2xl font-bold mb-8 sm:mb-12 flex items-center gap-3">
            <Zap size={24} className="text-accent-primary shrink-0" /> Metric Breakdown
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8 lg:gap-12">
            {metrics.map((m, i) => (
              <div key={i} className="flex flex-col items-center text-center">
                <div className="relative inline-flex items-center justify-center mb-6">
                  <svg className="w-24 h-24 sm:w-32 sm:h-32 transform -rotate-90 overflow-visible" viewBox="0 0 128 128">
                    <circle className="text-white/5" strokeWidth="8" stroke="currentColor" fill="transparent" r="54" cx="64" cy="64" />
                    <motion.circle 
                      className="text-accent-primary" 
                      strokeWidth="8" 
                      strokeDasharray={339.12}
                      initial={{ strokeDashoffset: 339.12 }}
                      animate={{ strokeDashoffset: 339.12 - (339.12 * m.score) / 10 }}
                      strokeLinecap="round" 
                      stroke="currentColor" 
                      fill="transparent" 
                      r="54" cx="64" cy="64" 
                    />
                  </svg>
                  <span className="absolute text-2xl sm:text-3xl font-black text-white">{m.score}</span>
                </div>
                <h4 className="font-bold text-base sm:text-lg mb-4">{m.label}</h4>
                <div className="flex flex-wrap justify-center gap-2">
                  {m.items.map((it, idx) => (
                    <span key={idx} className="text-[9px] sm:text-[10px] uppercase tracking-widest font-bold bg-white/5 px-3 py-1.5 rounded-full text-text-muted border border-white/5">{it}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Strengths & Growth */}
        <div className="card glass p-6 sm:p-10 group hover:border-success/30 transition-all">
          <h3 className="text-xl sm:text-2xl font-bold mb-6 sm:mb-8 flex items-center gap-3">
            <CheckCircle2 size={24} className="text-success shrink-0" /> Key Performance Strengths
          </h3>
          <ul className="space-y-4 sm:space-y-6">
            <StrengthItem text="Advanced articulation of architectural trade-offs in distributed systems." />
            <StrengthItem text="Exceptional mastery of React reconciliation and rendering optimizations." />
            <StrengthItem text="High-velocity problem solving under complex edge-case constraints." />
          </ul>
        </div>

        <div className="card glass p-6 sm:p-10 group hover:border-accent-primary/30 transition-all border-l-4 border-l-accent-primary col-span-full">
          <h3 className="text-xl sm:text-2xl font-bold mb-6 sm:mb-8 flex items-center gap-3">
            <Sparkles size={24} className="text-accent-primary shrink-0" /> AI Coding Insights
          </h3>
          <div className="p-6 bg-white/5 rounded-2xl border border-white/10 font-mono text-sm leading-relaxed text-text-secondary whitespace-pre-wrap">
            {app?.coding_logic || "No coding data available for this session."}
          </div>
        </div>
      </main>
    </div>
  );
};

const StrengthItem = ({ text }) => (
  <li className="flex gap-4">
    <div className="bg-success/10 p-2 rounded-lg h-fit">
        <CheckCircle2 size={18} className="text-success" />
    </div>
    <span className="text-text-secondary font-medium leading-relaxed">{text}</span>
  </li>
);

const GrowthItem = ({ text }) => (
  <li className="flex gap-4">
    <div className="bg-warning/10 p-2 rounded-lg h-fit">
        <Target size={18} className="text-warning" />
    </div>
    <span className="text-text-secondary font-medium leading-relaxed">{text}</span>
  </li>
);

export default CandidateReport;
