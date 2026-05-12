import 'regenerator-runtime/runtime';
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Mic, MicOff, Video, VideoOff, Terminal, CheckCircle2, Loader2, Play, Send, Zap, Eye, AlertTriangle, Clock, Code, PlayCircle, Sparkles, ChevronRight, Monitor, MessageSquare } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import Editor from '@monaco-editor/react';
import { supabase } from '../lib/supabase';
import { dbService } from '../services/dbService';
import { generateInterviewResponse, generateAiSpeech, generateCodeHint, evaluateCodeSession, generateCodingChallenge, evaluateInterview } from '../services/geminiService';
import './InterviewInterface.css';

// ─────────────────────────────────────────────────────────────────────────────
// Speech Hook
// ─────────────────────────────────────────────────────────────────────────────
const useSpeech = () => {
  const [displayTranscript, setDisplayTranscript] = useState('');
  const [listening, setListening] = useState(false);
  const [supported, setSupported] = useState(true);
  const [error, setError] = useState('');
  const recognitionRef = useRef(null);
  const finalRef = useRef('');
  const shouldRestartRef = useRef(false);
  const listeningRef = useRef(false);

  useEffect(() => {
    const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRec) { setSupported(false); return; }
    
    const rec = new SpeechRec();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = 'en-US';
    
    rec.onresult = (event) => {
      let newFinals = '', interim = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const t = event.results[i][0].transcript;
        if (event.results[i].isFinal) newFinals += t + ' '; else interim += t;
      }
      if (newFinals) finalRef.current += newFinals;
      setDisplayTranscript(finalRef.current + interim);
    };

    rec.onstart = () => { 
      setListening(true); 
      listeningRef.current = true; 
      setError(''); 
    };

    rec.onerror = (e) => {
      if (e.error === 'no-speech') return;
      console.warn('Speech error:', e.error);
      setError(e.error);
      if (e.error === 'network' || e.error === 'aborted') {
         // Don't stop forever on transient errors
      } else {
         shouldRestartRef.current = false;
      }
    };

    rec.onend = () => { 
      setListening(false); 
      listeningRef.current = false; 
      // CRITICAL: Restart if we are supposed to be listening
      if (shouldRestartRef.current) {
        try { rec.start(); } catch (err) { console.error('Restart failed:', err); }
      }
    };

    recognitionRef.current = rec;
    return () => { 
      shouldRestartRef.current = false; 
      try { rec.stop(); } catch (_) {} 
    };
  }, []);

  const startListening = useCallback(() => {
    if (!recognitionRef.current || listeningRef.current) return;
    shouldRestartRef.current = true;
    try { recognitionRef.current.start(); } catch (_) {}
  }, []);

  const stopListening = useCallback(() => {
    shouldRestartRef.current = false;
    try { recognitionRef.current?.stop(); } catch (_) {}
  }, []);

  const consumeTranscript = useCallback(() => {
    const full = finalRef.current.trim();
    finalRef.current = '';
    setDisplayTranscript('');
    return full;
  }, []);

  return { displayTranscript, listening, startListening, stopListening, consumeTranscript, supported, error };
};

// ─────────────────────────────────────────────────────────────────────────────
// Camera Analysis Hook
// ─────────────────────────────────────────────────────────────────────────────
const useCameraAnalysis = (videoRef, isActive) => {
  const [metrics, setMetrics] = useState({ faceDetected: false, centered: false, lighting: 'unknown', attentionScore: 0 });
  const canvasRef = useRef(document.createElement('canvas'));
  const rafRef = useRef(null);
  const frameCountRef = useRef(0);

  const analyzeFrame = useCallback(() => {
    const video = videoRef.current;
    if (!video || video.readyState < 2) { rafRef.current = requestAnimationFrame(analyzeFrame); return; }
    frameCountRef.current++;
    if (frameCountRef.current % 30 !== 0) { rafRef.current = requestAnimationFrame(analyzeFrame); return; }
    const canvas = canvasRef.current;
    const W = 160, H = 120;
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, W, H);
    const data = ctx.getImageData(0, 0, W, H).data;
    let skinPixels = 0, totalBrightness = 0, centerSkinPixels = 0;
    const cx1 = Math.floor(W * 0.3), cx2 = Math.floor(W * 0.7), cy1 = Math.floor(H * 0.1), cy2 = Math.floor(H * 0.6);
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const idx = (y * W + x) * 4;
        const r = data[idx], g = data[idx + 1], b = data[idx + 2];
        totalBrightness += (r + g + b) / 3;
        const isSkin = r > 60 && g > 40 && b > 20 && r > g && r > b && Math.abs(r - g) > 15 && r - b > 20 && r < 250;
        if (isSkin) { skinPixels++; if (x > cx1 && x < cx2 && y > cy1 && y < cy2) centerSkinPixels++; }
      }
    }
    const faceDetected = skinPixels / (W * H) > 0.04;
    const centered = centerSkinPixels > skinPixels * 0.4;
    const avg = totalBrightness / (W * H);
    const lighting = avg > 180 || avg < 60 ? 'poor' : 'good';
    let score = 0;
    if (faceDetected) score += 40;
    if (centered) score += 40;
    if (lighting === 'good') score += 20;
    setMetrics({ faceDetected, centered, lighting, attentionScore: score });
    rafRef.current = requestAnimationFrame(analyzeFrame);
  }, [videoRef]);

  useEffect(() => {
    if (isActive) rafRef.current = requestAnimationFrame(analyzeFrame);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [isActive, analyzeFrame]);

  return metrics;
};

// ─────────────────────────────────────────────────────────────────────────────
// Timer Hook
// ─────────────────────────────────────────────────────────────────────────────
const useInterviewTimer = (isRunning, minSeconds = 120) => {
  const [elapsed, setElapsed] = useState(0);
  const intervalRef = useRef(null);
  useEffect(() => {
    if (isRunning) intervalRef.current = setInterval(() => setElapsed(p => p + 1), 1000);
    return () => clearInterval(intervalRef.current);
  }, [isRunning]);
  const fmt = s => `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;
  return { canFinish: elapsed >= minSeconds, formattedElapsed: fmt(elapsed), formattedRemaining: fmt(Math.max(0, minSeconds - elapsed)) };
};

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────
const InterviewInterface = () => {
  const navigate = useNavigate();
  const { jobId } = useParams();
  const location = useLocation();
  const [job, setJob] = useState(location.state?.job || null);
  const [resumeText] = useState(location.state?.resumeText || '');
  const applicationId = location.state?.applicationId || null;

  const [isInitialized, setIsInitialized] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isMicOn, setIsMicOn] = useState(true);
  const [isVideoOn, setIsVideoOn] = useState(true);
  const [isAiThinking, setIsAiThinking] = useState(false);
  const [connectionError, setConnectionError] = useState('');
  const [history, setHistory] = useState([]);
  const [isFinishing, setIsFinishing] = useState(false);
  const [manualInput, setManualInput] = useState('');
  const [answerMetrics, setAnswerMetrics] = useState([]);

  // --- Real-time Coding States ---
  const [code, setCode] = useState('// Write your code here...');
  const [language, setLanguage] = useState('javascript');
  const [output, setOutput] = useState('');
  const [isRunning, setIsRunning] = useState(false);
  const [hint, setHint] = useState(null);
  const [isAiHinting, setIsAiHinting] = useState(false);
  const [remoteStream, setRemoteStream] = useState(null);
  const [activeTab, setActiveTab] = useState('editor'); // 'editor' | 'video' | 'chat'
  
  // --- New Phase States ---
  const [phase, setPhase] = useState('VERBAL'); // 'VERBAL' | 'CODING' | 'FINISHED'
  const [questionCount, setQuestionCount] = useState(0);
  const [codingChallenge, setCodingChallenge] = useState(null);
  const [testCaseResults, setTestCaseResults] = useState([]);
  const [parsingStatus, setParsingStatus] = useState('');
  const [cheatAttempts, setCheatAttempts] = useState(0);
  const [lastViolation, setLastViolation] = useState('');

  const videoRef = useRef(null);
  const cameraStreamRef = useRef(null);
  const chatEndRef = useRef(null);
  const silenceTimerRef = useRef(null);
  const isAiThinkingRef = useRef(false);
  const isMicOnRef = useRef(true);
  const historyRef = useRef([]);

  useEffect(() => { isAiThinkingRef.current = isAiThinking; }, [isAiThinking]);
  useEffect(() => { isMicOnRef.current = isMicOn; }, [isMicOn]);
  useEffect(() => { historyRef.current = history; }, [history]);

  const { displayTranscript, listening, startListening, stopListening, consumeTranscript, supported, error: speechError } = useSpeech();
  const cameraMetrics = useCameraAnalysis(videoRef, isInitialized && isVideoOn);
  const { canFinish, formattedElapsed, formattedRemaining } = useInterviewTimer(isInitialized, 120);

  // --- Refs ---
  const channelRef = useRef(null);
  const peerRef = useRef(null);
  const editorRef = useRef(null);
  const localStreamRef = useRef(null);

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [history, displayTranscript]);

  useEffect(() => {
    if (isInitialized && videoRef.current && cameraStreamRef.current) {
      videoRef.current.srcObject = cameraStreamRef.current;
      localStreamRef.current = cameraStreamRef.current;
    }
  }, [isInitialized]);

  useEffect(() => {
    if (!job) dbService.getJobs().then(jobs => setJob(jobs.find(j => j.id.toString() === jobId.toString())));
  }, [jobId, job]);

  useEffect(() => {
    if (displayTranscript.trim() && listening && !isAiThinkingRef.current) {
      clearTimeout(silenceTimerRef.current);
      // Increased to 3 seconds for better UX during slow speech
      silenceTimerRef.current = setTimeout(() => submitAnswer(), 3000);
    }
    return () => clearTimeout(silenceTimerRef.current);
  }, [displayTranscript]);

  // --- Anti-Cheating: Visibility Check ---
  useEffect(() => {
    const handleVisibility = () => {
      if (document.hidden && isInitialized && phase !== 'FINISHED') {
        setCheatAttempts(prev => prev + 1);
        setLastViolation('Tab Switch Detected');
        alert('WARNING: Tab switching is prohibited. This incident has been logged.');
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [isInitialized, phase]);

  const submitAnswer = useCallback(async (manualText = null) => {
    clearTimeout(silenceTimerRef.current);
    
    // Always consume transcript to clear the internal buffers
    const voiceText = consumeTranscript();
    const text = manualText ?? voiceText;
    
    if (!text.trim() || isAiThinkingRef.current) return;
    
    stopListening();
    setAnswerMetrics(prev => [...prev, { ...cameraMetrics, timestamp: Date.now(), answer: text }]);
    const newHistory = [...historyRef.current, { role: 'user', content: text }];
    setHistory(newHistory);
    setIsAiThinking(true);
    
    try {
      const nextCount = questionCount + 1;
      setQuestionCount(nextCount);
      
      if (nextCount < 5) {
        // Continue Verbal Round
        const aiResponse = await generateInterviewResponse(newHistory, job?.title || 'Role', job?.description || 'Technical Position', resumeText, true);
        setIsAiThinking(false);
        setHistory(prev => [...prev, { role: 'ai', content: aiResponse.question }]);
        await generateAiSpeech(aiResponse.question);
      } else if (nextCount === 5) {
        // Transition to Coding Round
        const transitionText = "Great points. Now, let's move to a practical coding challenge to see your skills in action. I'm preparing a problem based on your background...";
        setHistory(prev => [...prev, { role: 'ai', content: transitionText }]);
        await generateAiSpeech(transitionText);
        
        setIsAiThinking(true);
        const challenge = await generateCodingChallenge(resumeText, job?.title || 'Engineer');
        setCodingChallenge(challenge);
        setCode(challenge.starter_code);
        setLanguage(challenge.language);
        setPhase('CODING');
        setIsAiThinking(false);
        
        const challengeText = `Here is your challenge: ${challenge.title}. ${challenge.problem}`;
        setHistory(prev => [...prev, { role: 'ai', content: challengeText }]);
        await generateAiSpeech(challengeText);
      } else {
        // Final wrap-up logic
        const wrapUp = await generateInterviewResponse(newHistory, job?.title || 'Role', job?.description || 'Technical Position', resumeText, false);
        setIsAiThinking(false);
        setHistory(prev => [...prev, { role: 'ai', content: wrapUp.question }]);
        await generateAiSpeech(wrapUp.question);
      }
    } catch (err) {
      console.error('AI response error:', err);
      setIsAiThinking(false);
    } finally {
      // Re-enable listening after AI finishes speaking
      if (isMicOnRef.current) startListening();
    }
  }, [cameraMetrics, consumeTranscript, job, resumeText, stopListening, startListening, questionCount]);

  // --- Real-time Logic ---
  useEffect(() => {
    if (!isInitialized || !jobId) return;

    const channel = supabase.channel(`interview:${jobId}`, {
      config: { broadcast: { self: false } }
    });

    channel
      .on('broadcast', { event: 'code-change' }, ({ payload }) => {
        setCode(payload.code);
      })
      .on('broadcast', { event: 'sync-history' }, ({ payload }) => {
        setHistory(payload.history);
      })
      .on('broadcast', { event: 'webrtc-signal' }, async ({ payload }) => {
        handleWebRTCSignal(payload);
      })
      .subscribe();

    channelRef.current = channel;
    return () => { channel.unsubscribe(); };
  }, [isInitialized, jobId]);

  const handleWebRTCSignal = async (payload) => {
    if (!peerRef.current) setupWebRTC(false);
    const peer = peerRef.current;
    if (payload.type === 'offer') {
      await peer.setRemoteDescription(new RTCSessionDescription(payload.signal));
      const answer = await peer.createAnswer();
      await peer.setLocalDescription(answer);
      channelRef.current.send({
        type: 'broadcast',
        event: 'webrtc-signal',
        payload: { type: 'answer', signal: answer }
      });
    } else if (payload.type === 'answer') {
      await peer.setRemoteDescription(new RTCSessionDescription(payload.signal));
    } else if (payload.type === 'ice-candidate') {
      try { await peer.addIceCandidate(new RTCIceCandidate(payload.signal)); } catch (e) {}
    }
  };

  const setupWebRTC = (isInitiator) => {
    const peer = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
    });

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => peer.addTrack(track, localStreamRef.current));
    }

    peer.onicecandidate = (event) => {
      if (event.candidate) {
        channelRef.current.send({
          type: 'broadcast',
          event: 'webrtc-signal',
          payload: { type: 'ice-candidate', signal: event.candidate }
        });
      }
    };

    peer.ontrack = (event) => {
      setRemoteStream(event.streams[0]);
    };

    if (isInitiator) {
      peer.createOffer().then(async offer => {
        await peer.setLocalDescription(offer);
        channelRef.current.send({
          type: 'broadcast',
          event: 'webrtc-signal',
          payload: { type: 'offer', signal: offer }
        });
      });
    }

    peerRef.current = peer;
  };

  const handleCodeChange = (newCode) => {
    setCode(newCode);
    channelRef.current?.send({
      type: 'broadcast',
      event: 'code-change',
      payload: { code: newCode }
    });
  };

  const onEditorMount = (editor) => {
    editorRef.current = editor;
    
    // Anti-Cheating: Block Paste
    editor.onDidPaste(() => {
      setCheatAttempts(prev => prev + 1);
      setLastViolation('External Paste Detected');
      alert('WARNING: Pasting code is prohibited. Please type your solution.');
      editor.setValue('// Paste blocked. Please write the logic yourself.\n' + code);
    });
  };

  const runCode = async () => {
    setIsRunning(true);
    setOutput('Neural Sandbox: Initializing environment...');
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    try {
      // 1. Build a wrapper script that executes all test cases
      let testScript = code + "\n\n";
      
      if (phase === 'CODING' && codingChallenge?.test_cases) {
        codingChallenge.test_cases.forEach((tc, idx) => {
          // Wrap each call in a unique marker for parsing
          if (language === 'javascript') {
            testScript += `console.log("__TC_${idx}__", JSON.stringify(solution(${tc.input})));\n`;
          } else if (language === 'python') {
            testScript += `print(f"__TC_{${idx}}__ {json.dumps(solution(${tc.input}))}")\n`;
          }
        });
      }

      const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000';
      const response = await fetch(`${backendUrl}/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          language: language,
          code: testScript // Send the wrapped script
        })
      });
      
      clearTimeout(timeoutId);
      const data = await response.json();
      
      if (data.message) {
        setOutput(`Error: ${data.message}`);
        return;
      }

      const rawOutput = data.run.output || '';
      setOutput(rawOutput.replace(/__TC_\d+__ .*\n/g, '')); // Clean markers from display

      if (phase === 'CODING' && codingChallenge?.test_cases) {
        const results = codingChallenge.test_cases.map((tc, idx) => {
          const marker = `__TC_${idx}__`;
          const lines = rawOutput.split('\n');
          const resultLine = lines.find(l => l.includes(marker));
          
          let passed = false;
          if (resultLine) {
            const actualValue = resultLine.replace(marker, '').trim().replace(/^"|"$/g, '');
            passed = actualValue.toString() === tc.expected.toString();
          }
          
          return { ...tc, passed };
        });
        setTestCaseResults(results);

        // AUTO-CONCLUDE if all pass
        if (results.length > 0 && results.every(r => r.passed)) {
          const successMsg = "Excellent work! You've successfully passed all test cases. That concludes our technical round. You can now submit your session using the Complete Session button.";
          setHistory(prev => [...prev, { role: 'ai', content: successMsg }]);
          generateAiSpeech(successMsg);
          setPhase('FINISHED'); // Lock the editor/chat
        }
      }
    } catch (err) {
      setOutput('Error: Sandbox connection failed. Ensure the runner is active.');
    } finally {
      setIsRunning(false);
    }
  };

  const getAiHint = async () => {
    setIsAiHinting(true);
    try {
      const res = await generateCodeHint(job?.description || 'Technical Task', code, language);
      setHint(res.hint);
      setTimeout(() => setHint(null), 10000);
    } catch (err) {
      console.error(err);
    } finally {
      setIsAiHinting(false);
    }
  };

  const initializeSession = async () => {
    if (isConnecting || !supported) {
      if (!supported) setConnectionError('Web Speech API not supported. Use Chrome on desktop.');
      return;
    }
    setIsConnecting(true);
    setConnectionError('');
    setParsingStatus('Neural Parser: Analyzing Resume context...');
    
    try {
      try {
        const camStream = await navigator.mediaDevices.getUserMedia({ video: { width: 1280, height: 720, facingMode: 'user' }, audio: true });
        cameraStreamRef.current = camStream;
      } catch { setIsVideoOn(false); }
      
      setIsInitialized(true);
      setParsingStatus('Gemini Engine: Synthesizing initial prompt...');
      setIsAiThinking(true);
      
      const firstResponse = await generateInterviewResponse([], job?.title || 'Role', job?.description || 'Technical Position', resumeText, true);
      setIsAiThinking(false);
      setHistory([{ role: 'ai', content: firstResponse.question }]);
      await generateAiSpeech(firstResponse.question);
      startListening();
      setParsingStatus('');
      
      // Initiate WebRTC
      setTimeout(() => setupWebRTC(true), 1000);
    } catch (err) {
      console.error('Init failed:', err);
      setConnectionError('link failed. Check network and try again.');
      setIsInitialized(false);
    } finally {
      setIsConnecting(false);
    }
  };

  const toggleMic = () => {
    setIsMicOn(prev => { if (prev) { stopListening(); return false; } else { startListening(); return true; } });
  };

  const toggleVideo = () => {
    const track = cameraStreamRef.current?.getVideoTracks()[0];
    if (track) { track.enabled = !track.enabled; setIsVideoOn(track.enabled); }
  };

  const handleFinish = async () => {
    if (!canFinish) return;
    stopListening();
    setIsFinishing(true);
    setParsingStatus('Finalizing evaluation report...');
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      // 1. Evaluate Coding Round with VIOLATIONS
      const codingEvaluation = await evaluateCodeSession(codingChallenge?.problem || 'Technical Task', code, language, [], cheatAttempts);
      const passedCount = testCaseResults.filter(r => r.passed).length;

      // 2. Evaluate Verbal Round (Transcript) with VIOLATIONS
      const verbalEvaluation = await evaluateInterview(history, cameraMetrics, cheatAttempts);

      if (user && jobId) {
        // Normalize coding score from 0-10 to 0-100 for storage
        const normalizedCodingScore = (codingEvaluation?.score || (passedCount * 2)) * 10;

        const updatePayload = {
          status: 'completed',
          coding_score: normalizedCodingScore,
          coding_logic: codingEvaluation?.logic_notes || "Completed",
          coding_code: code,
          verbal_score: verbalEvaluation?.overall_score || 0,
          reasoning: `OVERALL EVALUATION:\n${verbalEvaluation?.summary || "Interview finished."}\n\nHIRE RECOMMENDATION: ${verbalEvaluation?.hire_recommendation || 'N/A'}\n\nSCORES:\n- Technical: ${verbalEvaluation?.technical_score}/10\n- Communication: ${verbalEvaluation?.communication_score}/10\n- Confidence: ${verbalEvaluation?.confidence_score}/10`
        };

        let updatedRows = [];

        // 3. Save everything to Supabase
        if (applicationId) {
          const { data, error } = await supabase
            .from('applications')
            .update(updatePayload)
            .eq('id', applicationId)
            .select('id');
          if (error) throw error;
          updatedRows = data || [];
        } else {
          const { data, error } = await supabase
            .from('applications')
            .update(updatePayload)
            .eq('candidate_id', user.id)
            .eq('job_id', jobId)
            .select('id');

          if (error) throw error;
          updatedRows = data || [];

          // Fallback for legacy rows where candidate_id might be missing but candidate_email exists.
          if (updatedRows.length === 0 && user.email) {
            const { data: emailData, error: emailError } = await supabase
              .from('applications')
              .update(updatePayload)
              .eq('candidate_email', user.email)
              .eq('job_id', jobId)
              .select('id');
            if (emailError) throw emailError;
            updatedRows = emailData || [];
          }
        }

        if (updatedRows.length === 0) {
          throw new Error('No matching application was found to update after interview completion.');
        }
      }

      navigate(`/report/${jobId}`, { 
        state: { 
          answerMetrics, 
          codingEvaluation, 
          verbalEvaluation,
          passedCount 
        } 
      });
    } catch (err) { 
      console.error('Finalization failed:', err);
      // Fallback redirect even if DB fails
      navigate(`/report/${jobId}`); 
    }
    finally { 
      setIsFinishing(false); 
      setParsingStatus('');
    }
  };

  return (
    <div className="interview-root">
      {/* 0. PERMISSION OVERLAY / MODAL */}
      <AnimatePresence>
        {!isInitialized && (
          <motion.div 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            exit={{ opacity: 0 }}
            className="permission-modal-overlay"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="permission-card"
            >
              <div className="init-icon">
                <Sparkles color="var(--accent-primary)" size={32} />
              </div>
              <h2>Ready for Interview?</h2>
              <p>Camera and mic will be enabled. The AI is ready to meet you.</p>
              
              <div className="permission-check-list">
                <div className="check-item"><CheckCircle2 size={16} /> <span>Chrome recommended</span></div>
                <div className="check-item"><CheckCircle2 size={16} /> <span>Quiet environment</span></div>
                <div className="check-item"><CheckCircle2 size={16} /> <span>5 Verbal + 1 Coding Round</span></div>
              </div>

              <button onClick={initializeSession} disabled={isConnecting} className="btn-primary-glow">
                {isConnecting ? (
                  <><Loader2 className="spin" size={20} /> Starting Interview...</>
                ) : (
                  "I'm Ready, Start Session"
                )}
              </button>
              
              {parsingStatus && (
                <div className="parsing-status-loader">
                  <div className="progress-bar-tiny"><motion.div animate={{ width: ['0%', '100%'] }} transition={{ duration: 2, repeat: Infinity }} className="progress-fill" /></div>
                  <span>{parsingStatus}</span>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 1. LEFT — Video Grid */}
      <div className="interview-left">
        <div className="interview-topbar">
          <div className="interview-brand">
            <div className="interview-brand-icon"><Monitor size={18} color="white" /></div>
            <div>
              <div className="interview-brand-label">HireAI Live</div>
              <div className="interview-live-dot">
                <div className="live-dot" />
                <span className="live-text">Live P2P</span>
              </div>
            </div>
          </div>
          <div className="interview-timer">
            <Clock size={14} color="var(--accent-primary)" />
            <span>{formattedElapsed}</span>
          </div>
        </div>

        <div className="video-grid">
          <div className="video-wrapper candidate">
            <video ref={videoRef} autoPlay playsInline muted />
            <div className="video-label">Candidate (You)</div>
            {!isVideoOn && <div className="video-placeholder"><VideoOff size={32} /></div>}
            
            {cameraMetrics.faceDetected && (
              <div className="camera-status-overlay">
                <div className="hud-chip">
                  <div className="hud-dot ok" />
                  <span>Face OK</span>
                </div>
              </div>
            )}
          </div>

          <div className="video-wrapper interviewer">
            {remoteStream ? (
              <video autoPlay playsInline ref={v => v && (v.srcObject = remoteStream)} />
            ) : (
              <div className="video-avatar-placeholder">
                <motion.img 
                   src="https://static.vecteezy.com/system/resources/thumbnails/057/857/247/small/elegant-classic-sentient-ai-counselor-avatar-isolated-trustworthy-appearance-premium-free-png.png" 
                   alt="AI Avatar" 
                   initial={{ opacity: 0, scale: 1.1 }}
                   animate={{ opacity: 0.8, scale: 1 }}
                   className="ai-avatar-img"
                />
                <div className="avatar-pulse" />
                <div className="video-label-status">AI Interviewer (Listening)</div>
              </div>
            )}
            <div className="video-label">Interviewer</div>
          </div>
        </div>

        <div className="interview-sidebar-controls">
          <button onClick={toggleMic} className={`sidebar-ctrl ${!isMicOn ? 'off' : ''}`}>
            {isMicOn ? <Mic size={18} /> : <MicOff size={18} />}
          </button>
          <button onClick={toggleVideo} className={`sidebar-ctrl ${!isVideoOn ? 'off' : ''}`}>
            {isVideoOn ? <Video size={18} /> : <VideoOff size={18} />}
          </button>
          <div className="voice-visualizer">
            {listening && <motion.div animate={{ height: [4, 12, 6, 14, 4] }} transition={{ repeat: Infinity, duration: 0.5 }} className="viz-bar" />}
            {listening && <motion.div animate={{ height: [8, 4, 14, 6, 8] }} transition={{ repeat: Infinity, duration: 0.6 }} className="viz-bar" />}
            {listening && <motion.div animate={{ height: [6, 14, 4, 10, 6] }} transition={{ repeat: Infinity, duration: 0.4 }} className="viz-bar" />}
          </div>
        </div>
      </div>

      {/* 2. CENTER — Monaco Editor */}
      <div className="interview-center">
        <div className="editor-header">
          <div className="editor-tabs">
            <div className="editor-tab active">
              <Code size={14} />
              <span>Solution.js</span>
            </div>
            <select value={language} onChange={(e) => setLanguage(e.target.value)} className="lang-select">
              <option value="javascript">JavaScript</option>
              <option value="python">Python</option>
              <option value="cpp">C++</option>
            </select>
          </div>
          <div className="editor-actions">
            <button className="btn-hint" onClick={getAiHint} disabled={isAiHinting}>
              {isAiHinting ? <Loader2 size={14} className="spin" /> : <Sparkles size={14} />}
              <span>Hint</span>
            </button>
            <button className="btn-run" onClick={runCode} disabled={isRunning}>
              {isRunning ? <Loader2 size={14} className="spin" /> : <PlayCircle size={14} />}
              <span>Run Code</span>
            </button>
          </div>
        </div>

        <div className="editor-container">
          <Editor
            height="100%"
            theme="vs-dark"
            language={language}
            value={code}
            onChange={handleCodeChange}
            onMount={onEditorMount}
            options={{
              fontSize: 14,
              minimap: { enabled: false },
              padding: { top: 20 },
              scrollBeyondLastLine: false,
              fontFamily: 'Fira Code, monospace',
              cursorBlinking: 'smooth',
              formatOnPaste: false, // Ensure built-in formatting doesn't trigger paste
              lineNumbers: 'on',
              domReadOnly: false,
              readOnly: false
            }}
          />
          <AnimatePresence>
            {hint && (
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="ai-hint-toast"
              >
                <div className="hint-icon"><Zap size={14} /></div>
                <p>{hint}</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="terminal-area">
          <div className="terminal-header">
            <div className="flex items-center gap-2">
              <Terminal size={14} />
              <span>Output Console</span>
            </div>
            {phase === 'CODING' && (
              <div className="test-case-summary">
                {testCaseResults.filter(r => r.passed).length}/{testCaseResults.length} Tests Passed
              </div>
            )}
          </div>
          <pre className="terminal-content">
            {cheatAttempts > 0 && (
              <div className="cheat-alert-log">
                <AlertTriangle size={14} />
                <span>Security Violation: {lastViolation} (Count: {cheatAttempts})</span>
              </div>
            )}
            {output || '> Neural Sandbox ready.'}
            {testCaseResults.length > 0 && (
               <div className="test-results-grid">
                 {testCaseResults.map((tr, idx) => (
                    <div key={idx} className={`test-chip ${tr.passed ? 'pass' : 'fail'}`}>
                      {tr.passed ? 'PASS' : 'FAIL'} Case {idx + 1}
                    </div>
                 ))}
               </div>
            )}
          </pre>
        </div>
      </div>

      {/* 3. RIGHT — Chat & Transcript */}
      <div className="interview-right">
        <div className="chat-header">
          <div className="flex items-center gap-2">
            <MessageSquare size={16} color="var(--accent-primary)" />
            <h3>Live Interview</h3>
          </div>
        </div>

        <div className="chat-messages">
          <AnimatePresence initial={false}>
            {history.map((msg, i) => (
              <motion.div
                key={i}
                className={`msg-row ${msg.role}`}
                initial={{ opacity: 0, x: msg.role === 'ai' ? -10 : 10 }}
                animate={{ opacity: 1, x: 0 }}
              >
                <div className={`msg-bubble ${msg.role}`}>
                  {msg.content}
                </div>
                <span className="msg-label">{msg.role === 'ai' ? 'Interviewer' : 'You'}</span>
              </motion.div>
            ))}
          </AnimatePresence>
          {displayTranscript && (
            <div className="msg-row user interim">
              <div className="msg-bubble user">
                {displayTranscript}
              </div>
              <span className="msg-label">Speaking...</span>
            </div>
          )}
          <div ref={chatEndRef} />
        </div>

        <div className="chat-bottom">
          <div className="chat-input-wrapper">
            <input
              type="text"
              disabled={phase === 'FINISHED'}
              value={manualInput}
              onChange={e => setManualInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && manualInput.trim() && phase !== 'FINISHED') { submitAnswer(manualInput); setManualInput(''); }
              }}
              placeholder={phase === 'FINISHED' ? "Interview concluded." : (listening ? "Listening..." : "Type your answer...")}
            />
            <button className="send-btn" onClick={() => { if (phase !== 'FINISHED') { submitAnswer(manualInput); setManualInput(''); } }} disabled={phase === 'FINISHED'}>
              <Send size={16} />
            </button>
          </div>

          {!canFinish ? (
            <div className="finish-timer-lock">
              <Clock size={12} />
              <span>Ready in {formattedRemaining}</span>
            </div>
          ) : (
            <button className="finish-interview-btn" onClick={handleFinish} disabled={isFinishing}>
              {isFinishing ? <Loader2 className="spin" /> : "Complete Session"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default InterviewInterface;