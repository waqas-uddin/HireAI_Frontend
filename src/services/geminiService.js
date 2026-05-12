import { GoogleGenAI } from "@google/genai";

let client = null;

// ─────────────────────────────────────────────────────────────────────────────
// Init
// ─────────────────────────────────────────────────────────────────────────────
export const initGemini = (apiKey) => {
  if (!apiKey) return;
  client = new GoogleGenAI({ 
    apiKey,
    apiVersion: 'v1'
  });
};

const ensureInit = () => {
  if (!client) {
    const key = import.meta.env.VITE_GEMINI_API_KEY || localStorage.getItem('gemini_api_key');
    if (!key) throw new Error("Gemini API key not found. Set VITE_GEMINI_API_KEY in .env");
    initGemini(key);
  }
};

// Refined list of supported models on v1
const MODELS = [
  "gemini-1.5-flash-latest", 
  "gemini-1.5-flash",
  "gemini-1.5-flash-8b",
  "gemini-1.5-pro",
  "gemini-2.0-flash"
];

// Try Groq first if available (faster/more reliable free tier), then fallback to Gemini
// Helper to safely parse JSON from AI (strips markdown markers)
const safeParseJson = (text) => {
  try {
    if (typeof text === 'object') return text;
    const clean = text.replace(/```json\n?|```/g, '').trim();
    return JSON.parse(clean);
  } catch (e) {
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start !== -1 && end !== -1) {
      try {
        return JSON.parse(text.substring(start, end + 1));
      } catch (e2) {}
    }
    throw new Error("Invalid response format from AI: " + text.substring(0, 50));
  }
};

const withFallback = async (fn, prompt, isJson = true) => {
  let lastError;
  const groqKey = import.meta.env.VITE_GROQ_API_KEY || localStorage.getItem('groq_api_key');
  
  if (groqKey) {
    try {
      console.info("Using Groq as primary provider...");
      const text = await callGroq(prompt);
      return isJson ? safeParseJson(text) : text;
    } catch (groqErr) {
      console.warn("Groq failed, falling back to Gemini:", groqErr.message);
      lastError = groqErr;
    }
  }

  if (!fn) throw lastError || new Error("No fallback function provided");

  // 2. Try Gemini Models as fallback
  for (const modelName of MODELS) {
    try {
      console.info(`Attempting Gemini model: ${modelName}`);
      const result = await fn(modelName);
      return result;
    } catch (err) {
      lastError = err;
      console.warn(`Gemini Model ${modelName} failed:`, err.message);
    }
  }

  throw lastError;
};

const callGemini = async (modelName, prompt) => {
  ensureInit();
  const response = await client.models.generateContent({
    model: modelName,
    contents: [{ role: 'user', parts: [{ text: prompt }] }]
  });
  return response.text();
};

const callGroq = async (prompt) => {
  const groqKey = import.meta.env.VITE_GROQ_API_KEY || localStorage.getItem('groq_api_key');
  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${groqKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      messages: [
        { role: "system", content: "You are a professional AI interviewer. You MUST respond with a valid JSON object. Do not include markdown code blocks or conversational text outside the JSON." },
        { role: "user", content: prompt }
      ],
      temperature: 0.5,
      response_format: { type: "json_object" }
    })
  });

  const data = await response.json();
  if (data.error) throw new Error(data.error.message);
  return data.choices[0].message.content;
};

// ─────────────────────────────────────────────────────────────────────────────
// Interview Question Generation
// ─────────────────────────────────────────────────────────────────────────────
const buildInterviewPrompt = (jobTitle, jobDescription, historyText, resumeText, isVerbalRound = true) => `
You are HireAI, a professional technical and behavioral interviewer.

ROLE BEING INTERVIEWED FOR: ${jobTitle}
JOB DESCRIPTION: ${jobDescription}

${resumeText ? `CANDIDATE'S RESUME:
${resumeText}

Use this resume to ask specific, targeted questions. Reference actual projects, 
technologies, and experiences.` : ''}

CONVERSATION SO FAR:
${historyText || 'No history yet — this is the first message.'}

INSTRUCTIONS:
- Ask exactly ONE question at a time.
- ${isVerbalRound ? 'We are in the VERBAL ROUND. Ask technical questions based on their resume.' : 'We are in the WRAP-UP. Summarize and thank the candidate.'}
- DYNAMIC FEEDBACK: If the user gave an answer, FIRST acknowledge it briefly (e.g., "That makes sense," or "Interesting choice of tech") before asking the next question.
- Do NOT repeat questions.
- If they gave a generic answer, ask for a SPECIFIC example.

Respond in this exact JSON format:
{
  "question": "your acknowledgment + your next question here",
  "reasoning": "why you asked this",
  "is_finished": false
}
`;

export const generateInterviewResponse = async (
  history,
  jobTitle,
  jobDescription,
  resumeText = '',
  isVerbalRound = true
) => {
  const historyText = history
    .map(h => `${h.role === 'ai' ? 'INTERVIEWER' : 'CANDIDATE'}: ${h.content}`)
    .join('\n');

  try {
    const prompt = buildInterviewPrompt(jobTitle, jobDescription, historyText, resumeText, isVerbalRound);
    return await withFallback(async (modelName) => {
      const text = await callGemini(modelName, prompt);
      return JSON.parse(text);
    }, prompt, true);
  } catch (err) {
    console.error("Gemini failed:", err);
    return {
      question: "That's interesting. Can you tell me more about how you'd handle edge cases in that scenario?",
      reasoning: "Fallback response",
      is_finished: false
    };
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Coding Round Generation
// ─────────────────────────────────────────────────────────────────────────────
export const generateCodingChallenge = async (resumeText, jobTitle) => {
  try {
    const prompt = `
      Based on the candidate's resume and the job title "${jobTitle}", generate a coding challenge.
      RESUME: ${resumeText}
      
      REQUIREMENTS:
      1. The problem should be technical and relevant to their experience level.
      2. Provide 5 hidden test cases.
      
      Respond in JSON:
      {
        "title": "Problem Title",
        "problem": "Detailed problem description with constraints",
        "starter_code": "function solution() { ... }",
        "language": "javascript",
        "test_cases": [
          { "input": "...", "expected": "..." },
          { "input": "...", "expected": "..." },
          { "input": "...", "expected": "..." },
          { "input": "...", "expected": "..." },
          { "input": "...", "expected": "..." }
        ]
      }
    `;
    return await withFallback(async (modelName) => {
      const text = await callGemini(modelName, prompt);
      return JSON.parse(text);
    }, prompt, true);
  } catch (err) {
    return {
      title: "Array Sum",
      problem: "Write a function that returns the sum of all elements in an array.",
      starter_code: "function solution(arr) {\n  // your code\n}",
      language: "javascript",
      test_cases: [
        { input: "[1,2,3]", expected: "6" },
        { input: "[0,0,0]", expected: "0" },
        { input: "[-1,1]", expected: "0" },
        { input: "[10]", expected: "10" },
        { input: "[]", expected: "0" }
      ]
    };
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// AI Speech (Text-to-Speech)
// ─────────────────────────────────────────────────────────────────────────────
let cachedVoice = null;

const loadBestVoice = () => {
  return new Promise((resolve) => {
    const pick = () => {
      const voices = window.speechSynthesis.getVoices();
      if (!voices.length) return null;

      const priority = [
        'Google US English',
        'Google UK English Female',
        'Google UK English Male',
        'Microsoft Mark - English (United States)',
        'Microsoft David - English (United States)',
      ];

      for (const name of priority) {
        const match = voices.find(v => v.name === name);
        if (match) return match;
      }

      return (
        voices.find(v => v.lang === 'en-US' && !v.localService) ||
        voices.find(v => v.lang.startsWith('en') && !v.localService) ||
        voices.find(v => v.lang.startsWith('en')) ||
        voices[0]
      );
    };

    const voice = pick();
    if (voice) { resolve(voice); return; }

    window.speechSynthesis.onvoiceschanged = () => {
      resolve(pick());
    };
  });
};

export const generateAiSpeech = async (text) => {
  window.speechSynthesis.cancel();

  const cleanText = text
    .replace(/```[\s\S]*?```/g, ' [Code Block skipped] ')
    .replace(/[`*#_~]/g, '')
    .replace(/\\/g, '')
    .replace(/\//g, ' ')
    .replace(/\[|\]/g, '')
    .trim();

  if (!cachedVoice) {
    cachedVoice = await loadBestVoice();
  }

  return new Promise((resolve) => {
    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.voice = cachedVoice;
    utterance.lang = 'en-US';
    utterance.rate = 0.92;
    utterance.pitch = 1.0;
    utterance.volume = 1.0;

    const keepAlive = setInterval(() => {
      if (!window.speechSynthesis.speaking) {
        clearInterval(keepAlive);
        return;
      }
      window.speechSynthesis.pause();
      window.speechSynthesis.resume();
    }, 10000);

    utterance.onend = () => {
      clearInterval(keepAlive);
      setTimeout(resolve, 300);
    };

    utterance.onerror = (e) => {
      clearInterval(keepAlive);
      console.error('TTS error:', e);
      resolve();
    };

    window.speechSynthesis.speak(utterance);
  });
};

// ─────────────────────────────────────────────────────────────────────────────
// Resume Screening
// ─────────────────────────────────────────────────────────────────────────────
export const SCREENING_PROMPT = (resumeText, jobCriteria) => `
Analyze the following resume against the job criteria.
Provide a "screening_score" (0-100) and brief "reasoning".
If score >= 70, set "is_eligible" to true.

JOB CRITERIA:
${jobCriteria}

RESUME TEXT:
${resumeText}

Respond in JSON only:
{
  "screening_score": number,
  "reasoning": "string",
  "is_eligible": boolean,
  "key_matches": ["skill or experience that matched"],
  "key_gaps": ["requirement that was missing or weak"]
}
`;

export const screenResume = async (resumeText, jobCriteria) => {
  try {
    const prompt = SCREENING_PROMPT(resumeText, jobCriteria);
    return await withFallback(async (modelName) => {
      const text = await callGemini(modelName, prompt);
      return JSON.parse(text);
    }, prompt, true);
  } catch (err) {
    console.error("Resume screening failed:", err);
    return { screening_score: 0, reasoning: "Screening unavailable.", is_eligible: false };
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Final Interview Evaluation
// ─────────────────────────────────────────────────────────────────────────────
export const EVALUATION_PROMPT = (transcript, cameraMetrics) => `
Perform a final evaluation of the following interview transcript.

Evaluation criteria:
1. Technical Score (50%): Depth, accuracy, and relevance of technical answers
2. Communication Score (30%): Clarity, structure, and professionalism
3. Confidence Score (20%): Based on answer completeness and directness

${cameraMetrics ? `BEHAVIORAL SIGNALS (from camera analysis):
- Average attention score: ${cameraMetrics.avgAttention}%
- Face consistently detected: ${cameraMetrics.faceDetectedRatio}%
- Lighting quality: ${cameraMetrics.lighting}
Use these as supplementary signals for confidence scoring only.` : ''}

INTERVIEW TRANSCRIPT:
${transcript}

Respond in JSON:
{
  "overall_score": number (0-10),
  "technical_score": number (0-10),
  "communication_score": number (0-10),
  "confidence_score": number (0-10),
  "hire_recommendation": "Strong Yes | Yes | Maybe | No",
  "key_strengths": ["string"],
  "improvement_areas": ["string"],
  "actionable_tips": ["specific tip for their next interview"],
  "summary": "2-3 sentence overall assessment"
}
`;

export const evaluateInterview = async (history, cameraMetrics = null, violations = 0) => {
  const transcript = history
    .map(h => `${h.role === 'ai' ? 'INTERVIEWER' : 'CANDIDATE'}: ${h.content}`)
    .join('\n\n');

  try {
    const prompt = EVALUATION_PROMPT(transcript, cameraMetrics) + `\n\nSECURITY VIOLATIONS: ${violations} (Deduct score significantly if > 0)`;
    return await withFallback(async (modelName) => {
      const text = await callGemini(modelName, prompt);
      return safeParseJson(text);
    }, prompt, true);
  } catch (err) {
    console.error("Evaluation failed:", err);
    return null;
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Job Criteria Generation (for recruiters)
// ─────────────────────────────────────────────────────────────────────────────
export const generateCriteria = async (jobTitle, jobDescription) => {
  try {
    const prompt = `
      You are an expert technical recruiter. 
      Create 5-6 clear evaluation criteria for hiring a ${jobTitle}.
      Job Description: ${jobDescription}
      Format as a concise bulleted list. Be specific and measurable.
    `;
    return await withFallback(async (modelName) => {
      return await callGemini(modelName, prompt);
    }, prompt, false);
  } catch (err) {
    console.error("Criteria generation failed:", err);
    throw err;
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Code Assistance & Evaluation
// ─────────────────────────────────────────────────────────────────────────────

export const generateCodeHint = async (problem, currentCode, language) => {
  try {
    const prompt = `
      You are a technical interviewer "Shadow AI". 
      PROBLEM: ${problem}
      LANGUAGE: ${language}
      CANDIDATE'S CURRENT CODE:
      \`\`\`${language}
      ${currentCode}
      \`\`\`

      INSTRUCTIONS:
      - Analyze the code for logic errors, syntax issues, or if the candidate seems stuck.
      - Provide ONE subtle hint. Do NOT provide the full solution.
      - Be encouraging but professional.

      Respond in JSON:
      {
        "hint": "string",
        "severity": "low | medium | high",
        "category": "logic | syntax | optimization"
      }
    `;
    return await withFallback(async (modelName) => {
      const text = await callGemini(modelName, prompt);
      return JSON.parse(text);
    }, prompt, true);
  } catch (err) {
    console.error("Hint generation failed:", err);
    return { hint: "Keep going! You're on the right track.", severity: "low", category: "logic" };
  }
};

export const evaluateCodeSession = async (problem, finalCode, language, sessionLogs = [], violations = 0) => {
  try {
    const prompt = `
      Evaluate the following coding session.
      PROBLEM: ${problem}
      FINAL CODE:
      \`\`\`${language}
      ${finalCode}
      \`\`\`
      VIOLATIONS DETECTED: ${violations}

      SESSION LOGS (deletions, time, etc): ${JSON.stringify(sessionLogs)}

      CRITERIA:
      1. Correctness: Does it solve the problem?
      2. Complexity: Is the O(n) optimal?
      3. Readability: Naming, structure, comments.
      4. Efficiency: How many times did they backtrack or struggle?
      5. Integrity: Deduct points if violations > 0.

      Respond in JSON:
      {
        "score": number (0-10),
        "correctness_score": number (0-10),
        "complexity_score": number (0-10),
        "readability_score": number (0-10),
        "logic_notes": "string",
        "optimal_solution_found": boolean
      }
    `;
    return await withFallback(async (modelName) => {
      const text = await callGemini(modelName, prompt);
      return safeParseJson(text);
    }, prompt, true);
  } catch (err) {
    console.error("Code evaluation failed:", err);
    return null;
  }
};