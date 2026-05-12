import React, { useState, useEffect } from 'react';
import { Search, Briefcase, MapPin, ChevronRight, ArrowLeft } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { dbService } from '../services/dbService';
import { supabase } from '../lib/supabase';

const JobBoard = ({ userRole }) => {
  const navigate = useNavigate();
  const [jobs, setJobs] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [appliedJobIds, setAppliedJobIds] = useState(new Set());

  useEffect(() => {
    loadJobs();
  }, []);

  useEffect(() => {
    const fetchApplied = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user && user.email) {
          const apps = await dbService.getCandidateApplications(user.email);
          setAppliedJobIds(new Set((apps || []).map(a => a.job_id)));
        }
      } catch (err) {
        console.error('Failed to load candidate applications', err);
      }
    };
    fetchApplied();
  }, []);

  const loadJobs = async () => {
    try {
      const data = await dbService.getJobs();
      setJobs(data);
    } catch (err) {
      console.error("Failed to load jobs", err);
    } finally {
      setLoading(false);
    }
  };

  const filteredJobs = jobs.filter(job => 
    job.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    job.domain.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="page-container">
      <header className="mb-16">
        <div className="flex flex-col md:flex-row md:items-start justify-start gap-12 lg:gap-32">
          <div className="max-w-2xl">
            <h1 className="text-5xl font-bold mb-4 tracking-tight">Open <span className="text-accent-primary">Opportunities.</span></h1>
            <p className="text-text-secondary text-lg">
               Join the future of hiring. Explore active roles across the HireAI ecosystem and find your perfect match.
            </p>
          </div>

          <div className="search-container">
            <div className="search-icon-wrapper">
              <Search size={20} />
            </div>
            <input 
              type="text" 
              className="search-input"
              placeholder="Search by role or domain..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
      </header>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {[1,2,3].map(i => <div key={i} className="card h-64 animate-pulse bg-white/5 rounded-3xl" />)}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          <AnimatePresence mode="popLayout">
            {filteredJobs.length === 0 ? (
                <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="col-span-full py-20 text-center"
                >
                    <p className="text-text-muted text-lg italic">No vacancies found matching your Job Role.</p>
                </motion.div>
            ) : (
                filteredJobs.map((job, idx) => (
                  <motion.div 
                    layout
                    key={job.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.05 }}
                    className="card glass p-8 group hover:border-accent-primary transition-all cursor-pointer relative overflow-hidden flex flex-col min-h-[320px]"
                    onClick={() => {
                      if (userRole === 'recruiter') {
                        alert("Recruiters cannot apply to jobs. Returning to Admin Console.");
                        navigate('/manager/dashboard');
                        return;
                      }

                      if (appliedJobIds.has(job.id)) {
                        alert('You have already applied to this role.');
                        return;
                      }

                      navigate(`/apply/${job.id}`, { state: { job } });
                    }}
                  >
                    {appliedJobIds.has(job.id) && (
                      <div className="absolute top-4 left-4 bg-white/5 text-text-muted px-3 py-1 rounded-full text-xs font-bold uppercase tracking-widest">
                      Applied
                      </div>
                    )}
                    <div className="absolute top-0 right-0 w-24 h-24 bg-accent-primary/10 blur-3xl -z-10 group-hover:bg-accent-primary/20 transition-all" />
                    
                    <div className="flex-grow">
                        <span className="text-[10px] font-bold text-accent-primary uppercase tracking-[0.2em] mb-4 block">{job.domain}</span>
                        <h3 className="text-2xl font-bold mb-4 leading-tight group-hover:text-accent-primary transition-colors">{job.title}</h3>
                        <p className="text-sm text-text-secondary line-clamp-4 leading-relaxed mb-6">
                            {job.description}
                        </p>
                    </div>

                    <div className="flex items-center justify-between pt-6 border-t border-white/5">
                        <div className="flex items-center gap-2 text-text-muted text-xs">
                           <MapPin size={14} />
                           <span>Remote / Flexible</span>
                        </div>
                        <div className="flex items-center gap-1 text-accent-primary font-bold text-sm group-hover:translate-x-1 transition-transform">
                           View & Apply <ChevronRight size={16} />
                        </div>
                    </div>
                  </motion.div>
                ))
            )}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
};

export default JobBoard;
