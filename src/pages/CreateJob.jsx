import React, { useState, useEffect } from 'react';
import { ArrowLeft, Sparkles, Save, ShieldCheck, Loader2, Zap } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { dbService } from '../services/dbService';
import { supabase } from '../lib/supabase';
import { generateCriteria } from '../services/geminiService';

const CreateJob = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [formData, setFormData] = useState({
    title: '',
    domain: 'Software Engineering',
    description: '',
    criteria: ''
  });
  const [isGenerating, setIsGenerating] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => setUser(user));
  }, []);

  const handleGenerateCriteria = async () => {
    if (!formData.description) return;
    setIsGenerating(true);
    
    try {
        const refined = await generateCriteria(formData.title, formData.description);
        setFormData(prev => ({ ...prev, criteria: refined }));
    } catch (err) {
        console.error("AI Generation failed", err);
        alert("AI Assistant error: " + (err.message || "Failed to generate criteria. Please check your API key."));
    } finally {
        setIsGenerating(false);
    }
  };

  const handleSave = async () => {
    if (!formData.title || !formData.criteria || !user) return;
    setLoading(true);
    
    try {
        await dbService.createJob({
            ...formData,
            created_by: user.id
        });
        navigate('/manager/dashboard');
    } catch (err) {
        alert("Job creation failed: " + err.message);
    } finally {
        setLoading(false);
    }
  };

  return (
    <div className="manager-main max-w-5xl mx-auto px-6">
      <header className="flex items-center gap-6 mb-12">
        <button 
            onClick={() => navigate('/manager/dashboard')} 
            className="w-10 h-10 flex items-center justify-center bg-white/5 rounded-xl border border-white/5 text-text-muted hover:text-white transition-all"
        >
          <ArrowLeft size={20} />
        </button>
        <div>
            <h1 className="text-4xl font-black tracking-tight text-white mb-1">Post a Job</h1>
            <p className="text-text-muted text-sm font-medium">Define your hiring requirements and interview criteria.</p>
        </div>
      </header>

      <div className="card glass p-10 border border-white/5 shadow-2xl relative">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-10">
            <div className="form-group">
                <label className="text-xs uppercase tracking-widest font-black text-accent-primary mb-3 block">Job Title</label>
                <input 
                    type="text" 
                    placeholder="e.g. Senior Software Engineer"
                    className="bg-bg-secondary border border-white/5 rounded-xl p-4 text-white focus:border-accent-primary outline-none w-full"
                    value={formData.title}
                    onChange={e => setFormData({...formData, title: e.target.value})}
                />
            </div>
            <div className="form-group">
                <label className="text-xs uppercase tracking-widest font-black text-accent-primary mb-3 block">Department / Domain</label>
                <select 
                    className="bg-bg-secondary border border-white/5 rounded-xl p-4 text-white focus:border-accent-primary outline-none w-full"
                    value={formData.domain}
                    onChange={e => setFormData({...formData, domain: e.target.value})}
                >
                    <option>Software Engineering</option>
                    <option>AI & Machine Learning</option>
                    <option>Product Management</option>
                    <option>System Architecture</option>
                    <option>Design & UX</option>
                </select>
            </div>
        </div>

        <div className="form-group mb-10">
            <label className="text-xs uppercase tracking-widest font-black text-accent-primary mb-3 block">Job Description</label>
            <textarea 
                className="bg-bg-secondary border border-white/5 rounded-2xl p-6 text-white focus:border-accent-primary outline-none w-full min-h-[160px] resize-none"
                placeholder="Paste the full job description here..."
                value={formData.description}
                onChange={e => setFormData({...formData, description: e.target.value})}
            />
            <div className="flex justify-end mt-4">
                <button 
                    className={`flex items-center gap-2 px-8 py-3 rounded-xl text-xs font-bold transition-all ${
                        isGenerating || !formData.description 
                        ? 'bg-neutral-800 text-neutral-500 cursor-not-allowed border border-white/5' 
                        : 'bg-accent-primary text-white hover:bg-accent-secondary shadow-lg shadow-accent-glow'
                    }`}
                    onClick={handleGenerateCriteria}
                    disabled={isGenerating || !formData.description}
                >
                    {isGenerating ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
                    {isGenerating ? 'AI analyzing...' : 'Synthesize Criteria'}
                </button>
            </div>
        </div>

        <div className="form-group mb-12">
            <div className="flex items-center gap-4 mb-4">
                <ShieldCheck className="text-success" size={20} />
                <label className="text-xs uppercase tracking-widest font-black text-white">Interview Benchmarks</label>
            </div>
            <textarea 
                className="bg-bg-secondary border-l-4 border-l-accent-primary rounded-r-2xl p-6 text-white font-mono text-sm leading-relaxed w-full min-h-[220px] resize-none"
                placeholder="AI-generated criteria will appear here..."
                value={formData.criteria}
                onChange={e => setFormData({...formData, criteria: e.target.value})}
            />
        </div>

        <div className="flex justify-end pt-8 border-t border-white/5">
            <button 
                className="btn-primary px-12 py-4 text-xl flex items-center gap-3 shadow-accent-glow" 
                onClick={handleSave}
                disabled={loading || !formData.criteria}
            >
                {loading ? <Loader2 size={24} className="animate-spin" /> : <Save size={24} />}
                <span className="font-bold">{loading ? 'Saving...' : 'Post Job'}</span>
            </button>
        </div>
      </div>
    </div>
  );
};

export default CreateJob;
