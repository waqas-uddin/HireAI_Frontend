import React, { useState, useEffect } from 'react';
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { supabase } from './lib/supabase';

// Layouts
import ManagerLayout from './layouts/ManagerLayout';
import TalentLayout from './layouts/TalentLayout';

// Pages
import Login from './pages/Login';
import Signup from './pages/Signup';
import Dashboard from './pages/Dashboard';
import CreateJob from './pages/CreateJob';
import Application from './pages/Application';
import JobBoard from './pages/JobBoard';
import CandidateDashboard from './pages/CandidateDashboard';
import InterviewInterface from './pages/InterviewInterface';
import CandidateReport from './pages/CandidateReport';

import { initGemini } from './services/geminiService';

function App() {
  const navigate = useNavigate();
  const envKey = import.meta.env.VITE_GEMINI_API_KEY;
  const [apiKey, setApiKey] = useState(envKey || localStorage.getItem('gemini_api_key') || '');
  const [showKeyModal, setShowKeyModal] = useState(!envKey && !localStorage.getItem('gemini_api_key'));
  const [user, setUser] = useState(null);
  const [userRole, setUserRole] = useState(localStorage.getItem('hireai_role') || null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const fetchRoleAndSetUser = async (session) => {
      if (!session?.user) {
        setUser(null);
        setUserRole(null);
        localStorage.removeItem('hireai_role');
        if (mounted) setIsLoading(false);
        return;
      }

      // Fetch real role from DB
      const { data: profile } = await supabase
        .from('profiles')
        .select('role, full_name')
        .eq('id', session.user.id)
        .single();
      
      if (profile && profile.role && mounted) {
        // Force state update with new profile data
        setUserRole(profile.role);
        setUser({ ...session.user, ...profile, full_name: profile.full_name });
        localStorage.setItem('hireai_role', profile.role);
      } else if (!profile || !profile.role) {
         setUser(null);
         setUserRole(null);
      }
      
      if (mounted) setIsLoading(false);
    };

    // Check initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      fetchRoleAndSetUser(session);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      // Only set loading to true if we are explicitly signing in for the first time
      // or if we don't have a user role yet.
      if (_event === 'SIGNED_IN' && !userRole) {
          setIsLoading(true); 
      }
      fetchRoleAndSetUser(session);
    });

    return () => {
        mounted = false;
        subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (apiKey) initGemini(apiKey);
  }, [apiKey]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/');
  };

  const saveApiKey = (key) => {
    localStorage.setItem('gemini_api_key', key);
    setApiKey(key);
    setShowKeyModal(false);
  };

  if (isLoading) {
    return (
      <div className="h-screen w-screen fixed inset-0 flex items-center justify-center bg-bg-primary z-[9999]">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-accent-primary"></div>
          <span className="text-text-muted text-sm font-medium animate-pulse">Authenticating Session...</span>
        </div>
      </div>
    );
  }

  return (
    <>
      <Routes>
        <Route path="/" element={
           user === undefined ? null :
           user 
            ? <Navigate to={userRole === 'recruiter' ? '/manager/dashboard' : '/talent/dashboard'} replace /> 
            : <Navigate to="/login" replace />
        } />
        
        <Route path="/login" element={
           user ? <Navigate to={userRole === 'recruiter' ? '/manager/dashboard' : '/talent/dashboard'} replace /> : <Login />
        } />

        <Route path="/signup" element={
           user ? <Navigate to={userRole === 'recruiter' ? '/manager/dashboard' : '/talent/dashboard'} replace /> : <Signup />
        } />

          <Route element={<TalentLayout user={user} userRole={userRole} onLogout={handleLogout} />}>
            <Route path="/jobs" element={
             user && userRole === 'candidate' ? <JobBoard userRole={userRole} /> : <Navigate to="/" replace />
            } />
           <Route path="/apply/:jobId" element={<Application userRole={userRole} user={user} />} />
           <Route path="/report/:jobId" element={<CandidateReport />} />
           
           <Route path="/talent/dashboard" element={
              user && userRole === 'candidate' 
                ? <CandidateDashboard user={user} /> 
                : <Navigate to="/" replace />
           } />
        </Route>

        <Route path="/manager" element={<ManagerLayout user={user} userRole={userRole} onLogout={handleLogout} />}>
           <Route index element={<Navigate to="/manager/dashboard" replace />} />
           <Route path="dashboard" element={
              user && userRole === 'recruiter' 
                ? <Dashboard user={user} />
                : <Navigate to="/" replace />
           } />
           <Route path="jobs/create" element={
              user && userRole === 'recruiter' 
                ? <CreateJob />
                : <Navigate to="/" replace />
           } />
        </Route>

        <Route path="/interview/:jobId" element={<InterviewInterface />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>

      {showKeyModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-xl flex items-center justify-center z-[2000] p-6 text-white">
          <div className="card glass p-8 w-full max-w-md border border-accent-primary/20">
            <h2 className="text-2xl font-bold mb-4">Gemini API Configuration</h2>
            <p className="text-text-secondary mb-6 text-sm">
              Please enter your Gemini Pro API key to enable AI screening and interviews.
            </p>
            <input 
              type="password" 
              className="w-full mb-6"
              placeholder="Enter Gemini API Key..."
              onChange={e => setApiKey(e.target.value)}
            />
            <button className="btn-primary w-full" onClick={() => saveApiKey(apiKey)}>
              Initialize Platform
            </button>
          </div>
        </div>
      )}
    </>
  );
}

export default App;
