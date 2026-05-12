import React, { useState, useEffect } from 'react';
import { Upload, CheckCircle, XCircle, Loader2, Sparkles, ArrowLeft, Briefcase } from 'lucide-react';
import { motion } from 'framer-motion';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { extractTextFromPDF } from '../utils/pdfParser';
import { dbService } from '../services/dbService';
import { screenResume } from '../services/geminiService';

const Application = ({ userRole, user }) => {
  const navigate = useNavigate();
  const { jobId } = useParams();
  const location = useLocation();

  const [selectedJob, setSelectedJob] = useState(location.state?.job || null);
  const [file, setFile] = useState(null);
  const [resumeText, setResumeText] = useState('');   // ← holds extracted text for DB save
  const [isProcessing, setIsProcessing] = useState(false);
  const [screeningResult, setScreeningResult] = useState(null);
  const [hasApplied, setHasApplied] = useState(false);
  const [loading, setLoading] = useState(false);      // ← moved to top where it belongs

  useEffect(() => {
    if (!selectedJob) loadJob();
  }, [jobId]);

  const loadJob = async () => {
    try {
      const jobs = await dbService.getJobs();
      const job = jobs.find(j => j.id.toString() === jobId.toString());
      setSelectedJob(job);
    } catch (err) {
      console.error('Error loading job', err);
    }
  };

  const handleFileUpload = async (e) => {
    const uploadedFile = e.target.files[0];
    if (!uploadedFile) return;

    setFile(uploadedFile);
    setIsProcessing(true);
    setScreeningResult(null);
    setResumeText('');

    try {
      // Step 1: Extract text from PDF
      const text = await extractTextFromPDF(uploadedFile);

      if (!text || text.trim().length < 50) {
        setScreeningResult({
          score: 0,
          reasoning: 'Could not extract readable text from this PDF. Try a non-scanned PDF.',
          status: 'error'
        });
        setIsProcessing(false);
        return;
      }

      // Step 2: Save to state so handleSubmitApplication can use it
      setResumeText(text);

      // Step 3: Call REAL Gemini screening — not a fake setTimeout
      const result = await screenResume(text, selectedJob?.criteria || '');

      setScreeningResult({
        score: result.screening_score,
        reasoning: result.reasoning,
        keyMatches: result.key_matches || [],
        keyGaps: result.key_gaps || [],
        status: result.is_eligible ? 'success' : 'rejected'
      });

    } catch (err) {
      console.error('Screening failed:', err);
      setScreeningResult({
        score: 0,
        reasoning: 'Screening service unavailable. Please try again.',
        status: 'error'
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSubmitApplication = async () => {
    if (!user) {
      alert('Please sign in as a candidate to submit your application.');
      return;
    }
    if (!resumeText) {
      alert('Resume text missing. Please re-upload your resume.');
      return;
    }

    setLoading(true);
    try {
      await dbService.submitApplication({
        job_id: selectedJob.id,
        candidate_id: user.id,
        candidate_email: user.email,
        resume_score: screeningResult.score,
        reasoning: screeningResult.reasoning,
        resume_text: resumeText,   // ← now actually saved to DB
        status: 'pending'
      });
      setHasApplied(true);
    } catch (err) {
      console.error('Submission failed:', err);
      alert('Failed to submit application. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // ── Post-submission confirmation screen ──
  if (hasApplied) {
    return (
      <div className="talent-main flex items-center justify-center min-h-[60vh]">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="card glass p-12 text-center max-w-xl"
        >
          <div className="w-20 h-20 bg-success/10 rounded-full flex items-center justify-center text-success mx-auto mb-8">
            <CheckCircle size={40} />
          </div>
          <h2 className="text-4xl font-bold mb-4">Application Submitted!</h2>
          <p className="text-text-secondary text-lg mb-8 leading-relaxed">
            Your resume scored <span className="text-accent-primary font-bold">{screeningResult?.score}%</span> against
            the role benchmarks and has been sent for recruiter review.
            <span className="block mt-4 font-bold text-white">Current Status: Pending Review</span>
          </p>
          <div className="bg-white/5 p-6 rounded-2xl border border-white/5 mb-8 text-left">
            <p className="text-xs uppercase tracking-widest text-text-muted font-bold mb-2">Next Step</p>
            <p className="text-sm">
              If your profile matches effectively, the recruiter will invite you for an
              adaptive AI interview tailored to your resume.
            </p>
          </div>
          <button className="btn-primary w-full" onClick={() => navigate('/talent/dashboard')}>
            Go to My Dashboard
          </button>
        </motion.div>
      </div>
    );
  }

  // ── Main application form ──
  return (
    <div className="page-container">
      <header className="mb-12">
        <button className="btn-ghost flex items-center gap-2 mb-4 text-xs" onClick={() => navigate('/jobs')}>
          <ArrowLeft size={14} /> Back to Job Board
        </button>
        <h1 className="text-5xl font-bold mb-4 tracking-tight">
          Application <span className="text-accent-primary">Portal.</span>
        </h1>
        <p className="text-text-secondary text-lg">
          Position: <span className="text-white font-bold">{selectedJob?.title || 'Loading...'}</span>
        </p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">

        {/* Left: Job Description */}
        <div className="lg:col-span-5">
          <div className="card glass p-8 sticky top-32">
            <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
              <Briefcase size={20} className="text-accent-primary" /> Job Description
            </h3>
            <div className="text-text-secondary text-base leading-relaxed whitespace-pre-wrap">
              {selectedJob?.description || 'No description provided.'}
            </div>
          </div>
        </div>

        {/* Right: Resume upload + screening result */}
        <div className="lg:col-span-7">
          <div className="card glass p-10 border-dashed border-2 border-border-color">
            <input
              type="file"
              id="resume-upload"
              className="hidden"
              accept=".pdf"
              onChange={handleFileUpload}
              disabled={isProcessing}
            />

            <label
              htmlFor="resume-upload"
              className={`flex flex-col items-center justify-center min-h-[300px] rounded-3xl transition-all
                ${isProcessing || screeningResult ? 'cursor-default' : 'cursor-pointer hover:bg-white/5'}`}
            >
              {/* State 1: Processing */}
              {isProcessing && (
                <div className="flex flex-col items-center gap-6">
                  <Loader2 size={48} className="animate-spin text-accent-primary" />
                  <div className="text-center">
                    <p className="font-bold text-xl mb-1">Analyzing Resume...</p>
                    <p className="text-text-muted text-sm">Matching against job benchmarks via AI</p>
                  </div>
                </div>
              )}

              {/* State 2: Screening result */}
              {!isProcessing && screeningResult && (
                <div className="text-center w-full">
                  <div className={`w-16 h-16 rounded-2xl mx-auto mb-6 flex items-center justify-center
                    ${screeningResult.status === 'success' ? 'bg-success/10 text-success' : 'bg-error/10 text-error'}`}
                  >
                    {screeningResult.status === 'success' ? <CheckCircle size={32} /> : <XCircle size={32} />}
                  </div>

                  <h4 className="text-3xl font-bold mb-2 tracking-tight">
                    Match Score: <span className="text-accent-primary">{screeningResult.score}%</span>
                  </h4>

                  <p className="text-text-secondary max-w-sm mx-auto mb-6 leading-relaxed italic text-sm">
                    "{screeningResult.reasoning}"
                  </p>

                  {/* Key matches and gaps */}
                  {(screeningResult.keyMatches?.length > 0 || screeningResult.keyGaps?.length > 0) && (
                    <div className="grid grid-cols-2 gap-4 mb-8 text-left text-xs">
                      <div className="bg-success/5 border border-success/10 rounded-2xl p-4">
                        <p className="font-bold text-success mb-2 uppercase tracking-widest">Strengths</p>
                        <ul className="space-y-1 text-text-secondary">
                          {screeningResult.keyMatches.map((m, i) => <li key={i}>✓ {m}</li>)}
                        </ul>
                      </div>
                      <div className="bg-error/5 border border-error/10 rounded-2xl p-4">
                        <p className="font-bold text-error mb-2 uppercase tracking-widest">Gaps</p>
                        <ul className="space-y-1 text-text-secondary">
                          {screeningResult.keyGaps.map((g, i) => <li key={i}>✗ {g}</li>)}
                        </ul>
                      </div>
                    </div>
                  )}

                  <div className="flex flex-col items-center gap-3" onClick={e => e.preventDefault()}>
                    {screeningResult.status === 'success' ? (
                      <button
                        className="btn-primary w-full max-w-xs"
                        onClick={handleSubmitApplication}
                        disabled={loading}
                      >
                        {loading ? 'Submitting...' : 'Submit Application'}
                      </button>
                    ) : (
                      <p className="text-error text-sm font-bold">
                        Score below threshold. Consider strengthening your resume for this role.
                      </p>
                    )}
                    <button
                      className="btn-ghost text-xs w-full max-w-xs"
                      onClick={() => { setScreeningResult(null); setFile(null); setResumeText(''); }}
                    >
                      Upload a different resume
                    </button>
                  </div>
                </div>
              )}

              {/* State 3: Empty / waiting for upload */}
              {!isProcessing && !screeningResult && (
                <>
                  <div className="w-20 h-20 bg-accent-glow flex items-center justify-center rounded-3xl text-accent-primary mb-6 group-hover:scale-110 transition-transform">
                    <Upload size={32} />
                  </div>
                  <div className="text-center">
                    <p className="font-bold text-2xl mb-2">Drop your resume here</p>
                    <p className="text-text-muted">
                      or <span className="text-accent-primary">click to browse</span> (PDF only)
                    </p>
                  </div>
                  {file && (
                    <p className="mt-4 text-xs font-bold text-accent-primary uppercase tracking-widest">
                      {file.name}
                    </p>
                  )}
                </>
              )}
            </label>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Application;