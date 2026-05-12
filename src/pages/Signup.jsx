import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { User, LayoutDashboard, Mail, Lock, Sparkles, LogIn } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useNavigate, Link } from 'react-router-dom';

const Signup = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState('candidate'); // 'candidate' or 'recruiter'
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSignup = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const { data: authData, error: signupError } = await supabase.auth.signUp({
        email,
        password,
      });
      if (signupError) throw signupError;

      if (authData.user) {
        const { error: profileError } = await supabase
          .from('profiles')
          .insert([
            { id: authData.user.id, email: email, role: mode }
          ]);
        if (profileError) throw profileError;
      }
      alert("Signed up successfully!");
      setLoading(false);
      navigate('/login');
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-bg-primary flex items-center justify-center p-6 bg-gradient-to-br from-bg-primary via-bg-surface to-bg-primary">
      <div className="w-full max-w-5xl grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
        
        {/* Left Side: Branding */}
        <motion.div
          initial={{ opacity: 0, x: -30 }}
          animate={{ opacity: 1, x: 0 }}
          className="text-left"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent-glow border border-accent-primary/20 text-accent-primary text-[10px] font-bold uppercase tracking-widest mb-8">
            <Sparkles size={12} /> Enterprise Edition v2.0
          </div>
          <h1 className="text-7xl font-bold mb-6 tracking-tight">HireAI <br/><span className="text-accent-primary italic">Platform.</span></h1>
          <p className="text-xl text-text-secondary mb-12 max-w-md leading-relaxed">
            Revolutionizing recruitment with neural intelligence. 
            The only adaptive interview ecosystem designed for humans.
          </p>
          
          <div className="flex items-center gap-6 text-text-muted">
            <div className="flex flex-col">
              <span className="text-2xl font-bold text-white">10k+</span>
              <span className="text-xs uppercase tracking-widest">Interviews</span>
            </div>
            <div className="w-[1px] h-8 bg-border-color" />
            <div className="flex flex-col">
              <span className="text-2xl font-bold text-white">99%</span>
              <span className="text-xs uppercase tracking-widest">Accuracy</span>
            </div>
          </div>
        </motion.div>

        {/* Right Side: Auth Card */}
        <motion.div
           initial={{ opacity: 0, y: 30 }}
           animate={{ opacity: 1, y: 0 }}
           className="card glass p-8 border border-white/5 relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 w-32 h-32 bg-accent-primary/10 blur-3xl -z-10" />
          
          <div className="flex justify-center mb-10">
            <div className="segmented-control">
              <button 
                type="button"
                className={`control-item ${mode === 'candidate' ? 'active' : ''}`}
                onClick={() => setMode('candidate')}
              >
                <User size={16} /> Candidate
              </button>
              <button 
                type="button"
                className={`control-item ${mode === 'recruiter' ? 'active' : ''}`}
                onClick={() => setMode('recruiter')}
              >
                <LayoutDashboard size={16} /> Recruiter
              </button>
            </div>
          </div>

          <h2 className="text-3xl font-bold mb-2 text-center text-white">
            Create Your Account
          </h2>
          <p className="text-text-secondary text-center text-sm mb-10 font-medium">Select a role and define your access credentials</p>

          <form onSubmit={handleSignup} className="space-y-6">
            <div className="form-input-container">
              <Mail className="input-icon" size={18} />
              <input 
                type="email" 
                placeholder="Email address"
                className="input-field"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
              />
            </div>
            
            <div className="form-input-container">
              <Lock className="input-icon" size={18} />
              <input 
                type="password" 
                placeholder="Password"
                className="input-field"
                required
                value={password}
                onChange={e => setPassword(e.target.value)}
              />
            </div>

            {error && <p className="text-error text-[10px] font-bold uppercase tracking-widest text-center animate-pulse">{error}</p>}

            <button 
              type="submit" 
              className="btn-primary w-full py-4 text-lg mt-6 shadow-accent-glow"
              disabled={loading}
            >
              {loading ? (
                <div className="flex items-center justify-center gap-2">
                   <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                   Processing...
                </div>
              ) : (
                <div className="flex items-center justify-center gap-2 font-bold">
                  <LogIn size={20} />
                  Create Account
                </div>
              )}
            </button>
          </form>

          <div className="mt-12 pt-8 border-t border-white/5 text-center">
             <p className="text-sm text-text-secondary">
               Already have an existing account?
               <Link to="/login" className="text-accent-primary font-bold ml-2 hover:text-white transition-colors underline-offset-4 hover:underline cursor-pointer">
                 Sign In
               </Link>
             </p>
          </div>
        </motion.div>

      </div>
    </div>
  );
};

export default Signup;
