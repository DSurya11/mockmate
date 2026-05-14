import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState, useCallback } from "react";
import { api, type Interview } from "@/lib/mock-api";
import { Button } from "@/components/ui-kit/Button";
import { Logo } from "@/components/ui-kit/Logo";
import { ScoreRing } from "@/components/charts/Charts";
import { useAuth } from "@/stores/auth";

type InterviewPhase = 
  | "GREETING"        // Phase 1 — interviewer speaks first
  | "SMALL_TALK"      // Phase 2 — get name, build rapport
  | "AGENDA"          // Phase 3 — explain structure
  | "BACKGROUND"      // Phase 4 — soft warmup questions
  | "CORE_QUESTIONS"  // Phase 5 — the real interview
  | "CLOSING";         // Phase 6 — wrap up

export const Route = createFileRoute("/interview/$id")({
  component: InterviewRoom,
});

const QUESTION_SECONDS = 120;
const SPEAKING_DELAY_SECONDS = 3; // Delay after AI finishes speaking before user can start answering

const INTERVIEWERS = [
  { 
    id: "alex", 
    name: "Alex", 
    title: "Senior Backend Engineer", 
    gender: "male", 
    voice: "en_US-ryan-high",
    tone: "analytical and calm",
    specialty: "backend systems, APIs, databases"
  },
  { 
    id: "marcus", 
    name: "Marcus", 
    title: "Staff Systems Engineer", 
    gender: "male", 
    voice: "en_US-joe-medium",
    tone: "direct and thorough",
    specialty: "system design, infrastructure, scalability"
  },
  { 
    id: "sarah", 
    name: "Sarah", 
    title: "Senior Engineering Manager", 
    gender: "female", 
    voice: "en_US-amy-low",
    tone: "warm and structured",
    specialty: "behavioral questions, leadership, team dynamics"
  }
];

function InterviewRoom() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const auth = useAuth();
  const [iv, setIv] = useState<Interview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // session UI state
  const [questionIndex, setQuestionIndex] = useState(0);
  const [transcript, setTranscript] = useState("");
  const [interimTranscript, setInterimTranscript] = useState("");
  // Keep refs in sync so deep callbacks can read latest without being in deps
  useEffect(() => { transcriptRef.current = transcript; }, [transcript]);
  useEffect(() => { interimTranscriptRef.current = interimTranscript; }, [interimTranscript]);
  const [recording, setRecording] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(QUESTION_SECONDS);
  const [submitting, setSubmitting] = useState(false);
  const autoSubmitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingAutoSubmitRef = useRef<string | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const startTimeRef = useRef<number>(0);

  const [interviewer] = useState(() => INTERVIEWERS[Math.floor(Math.random() * INTERVIEWERS.length)]);
  const [speaking, setSpeaking] = useState(false);
  const [speakingDelay, setSpeakingDelay] = useState(0);
  const inSpeakingDelay = useRef(false);
  const greetingStarted = useRef(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  
  // Audio lifecycle management
  const ttsPlayingRef = useRef(false);
  const interviewActiveRef = useRef(false);
  
  // Runtime stabilization guards
  const mountedRef = useRef(true);

  // SpeechRecognition for live visual feedback during recording (display only — Whisper handles submission)
  const speechRecognitionRef = useRef<any>(null);

  // Interview phase management
  const [interviewPhase, setInterviewPhase] = useState<InterviewPhase>("GREETING");
  const [candidateName, setCandidateName] = useState<string | null>(null);
  const [warmupQuestionsAsked, setWarmupQuestionsAsked] = useState(0);
  const [closingTurnCount, setClosingTurnCount] = useState(0);
  const [exchangeCount, setExchangeCount] = useState(0);
  const [conversationHistory, setConversationHistory] = useState<Array<{role: string, content: string}>>([]);
  const [resumeSummary, setResumeSummary] = useState("No resume provided.");
  const [resumeField, setResumeField] = useState("software engineering");
  const [transcribing, setTranscribing] = useState(false);

  // Refs that mirror transcript state so useCallback closures ([] deps) can read latest values
  const transcriptRef = useRef("");
  const interimTranscriptRef = useRef("");
  // Ref to always-latest handleNext (avoids stale closures in setTimeout callbacks)
  const handleNextRef = useRef<((text?: string) => Promise<void>) | null>(null);
  const finalizingInterviewRef = useRef(false);
  const interviewCancelledRef = useRef(false);
  const ttsPlaybackResolveRef = useRef<(() => void) | null>(null);

  // Phase transition logic
  const getNextPhase = useCallback((currentPhase: InterviewPhase, currentExchangeCount: number, currentWarmupQuestionsAsked: number, totalQuestions: number): InterviewPhase => {
    switch (currentPhase) {
      case "GREETING":
        // Move after ONE candidate response
        return "SMALL_TALK"

      case "SMALL_TALK":
        // Move after 2-3 exchanges (candidateName captured + 1 soft question answered)
        if (currentExchangeCount >= 3) return "AGENDA"
        return "SMALL_TALK"

      case "AGENDA":
        // Move after candidate acknowledges
        return "BACKGROUND"

      case "BACKGROUND":
        // Move after 2 warmup questions answered
        if (currentWarmupQuestionsAsked >= 2) return "CORE_QUESTIONS"
        return "BACKGROUND"

      case "CORE_QUESTIONS":
        // Move after all generated questions answered
        if (questionIndex >= totalQuestions - 1) return "CLOSING"
        return "CORE_QUESTIONS"

      case "CLOSING":
        return "CLOSING" // terminal state
    }
  }, [questionIndex]);

  const cleanupInterviewAudioState = useCallback(() => {
    console.log("Cleaning up interview audio state");
    
    // Stop TTS
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.onended = null;
      audioRef.current.onerror = null;
      audioRef.current = null;
    }
    window.speechSynthesis.cancel();
    if (ttsPlaybackResolveRef.current) {
      ttsPlaybackResolveRef.current();
      ttsPlaybackResolveRef.current = null;
    }
    
    // Reset state refs — only clears the playing flag if we actually had audio
    ttsPlayingRef.current = false;
    setSpeaking(false);
  }, []);

  // Dedicated unmount cleanup — runs ONLY on true component unmount
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      interviewActiveRef.current = false;
      if (mediaRecorderRef.current) {
        try { mediaRecorderRef.current.stop(); } catch {}
        mediaRecorderRef.current = null;
      }
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.onended = null;
        audioRef.current.onerror = null;
        audioRef.current = null;
      }
      window.speechSynthesis.cancel();
      ttsPlayingRef.current = false;
      if (speechRecognitionRef.current) {
        try { speechRecognitionRef.current.stop(); } catch {}
        speechRecognitionRef.current = null;
      }
      if (autoSubmitTimerRef.current) {
        clearTimeout(autoSubmitTimerRef.current);
        autoSubmitTimerRef.current = null;
      }
    };
  }, []);

  
  // load interview
  useEffect(() => {
    if (auth.status === "unauthenticated") navigate({ to: "/login" });
  }, [auth.status, navigate]);

  useEffect(() => {
    let cancelled = false;
    api
      .getInterview(id)
      .then((data) => {
        if (!cancelled) setIv(data);
      })
      .catch((e) => {
        if (!cancelled) setError(e.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  // Load resume data to enrich the conversational interview context
  useEffect(() => {
    api.getResumes().then(resumes => {
      const ready = resumes.find(r => r.status === "ready");
      if (ready) {
        if (ready.summary) setResumeSummary(ready.summary);
        if (ready.skills?.length) setResumeField(ready.skills.slice(0, 5).join(", "));
      }
    }).catch(() => {});
  }, []);

  // camera setup (only when in_progress)
  const initCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }
    } catch (e) {
      console.warn("Camera/mic denied", e);
    }
  }, []);

  useEffect(() => {
    if (iv?.status === "in_progress") initCamera();
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, [iv?.status, initCamera]);

  useEffect(() => {
    if (iv?.status !== "in_progress") return;

    const handleTabSwitch = async () => {
      if (!mountedRef.current || interviewCancelledRef.current || finalizingInterviewRef.current) return;

      interviewCancelledRef.current = true;
      finalizingInterviewRef.current = true;
      cleanupInterviewAudioState();
      setRecording(false);
      setSpeakingDelay(0);

      if (speechRecognitionRef.current) {
        try { speechRecognitionRef.current.stop(); } catch {}
        speechRecognitionRef.current = null;
      }

      if (mediaRecorderRef.current) {
        try { mediaRecorderRef.current.stop(); } catch {}
        mediaRecorderRef.current = null;
      }

      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;

      try {
        const updated = await api.cancelInterview(iv.id);
        if (mountedRef.current) setIv(updated);
      } catch (error) {
        console.error("Failed to cancel interview after tab switch:", error);
        if (mountedRef.current) {
          setIv((current) => (current ? { ...current, status: "cancelled" } : current));
        }
      } finally {
        if (mountedRef.current) {
          finalizingInterviewRef.current = false;
        }
      }
    };

    const onVisibilityChange = () => {
      if (document.visibilityState !== "visible") {
        void handleTabSwitch();
      }
    };

    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [iv?.id, iv?.status, cleanupInterviewAudioState]);

  const stopRecording = useCallback(async () => {
    console.log("Manual stop recording");
    if (!mountedRef.current) return;
    
    setRecording(false);

    // Stop live transcript recognition
    if (speechRecognitionRef.current) {
      try { speechRecognitionRef.current.stop(); } catch {}
      speechRecognitionRef.current = null;
    }
    
    if (mediaRecorderRef.current) {
      try {
        mediaRecorderRef.current.stop();
      } catch (e) {
        console.warn("Failed to stop media recorder", e);
      }
      mediaRecorderRef.current = null;
    } else {
      // MediaRecorder was never started (stream unavailable) — fall back to browser transcript
      const fallback = (transcriptRef.current || interimTranscriptRef.current).trim();
      console.warn("No MediaRecorder at stop-time; falling back to browser transcript:", fallback);
      // Submit immediately via ref — no countdown
      handleNextRef.current?.(fallback);
    }
    
    cleanupInterviewAudioState();
  }, [cleanupInterviewAudioState]);

  // timer — pure countdown, no side effects inside the state setter
  useEffect(() => {
    if (!recording || !mountedRef.current) return;
    
    const t = setInterval(() => {
      if (!mountedRef.current) { clearInterval(t); return; }
      setSecondsLeft((s) => (s <= 1 ? 0 : s - 1));
    }, 1000);
    
    return () => clearInterval(t);
  }, [recording]);

  // Stop recording when timer reaches 0 (separate effect — keeps state setter pure)
  useEffect(() => {
    if (secondsLeft === 0 && recording) {
      stopRecording();
    }
  }, [secondsLeft, recording, stopRecording]);


  // speaking delay countdown
  useEffect(() => {
    if (speakingDelay <= 0) return;
    const t = setInterval(() => {
      setSpeakingDelay((s) => {
        if (s <= 1) {
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [speakingDelay]);

  // Start recording when speaking delay ends
  useEffect(() => {
    if (speakingDelay === 0 && inSpeakingDelay.current && !speaking && !recording && !mediaRecorderRef.current) {
      inSpeakingDelay.current = false;
      startRecording();
    }
  }, [speakingDelay, speaking, recording]);

  function startRecording() {
    setTranscript("");
    setInterimTranscript("");
    setSecondsLeft(QUESTION_SECONDS);
    startTimeRef.current = Date.now();
    setRecording(true);

    // --- Live transcript via browser SpeechRecognition (display only) ---
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SR) {
      try {
        const sr = new SR();
        sr.continuous = true;
        sr.interimResults = true;
        sr.lang = "en-US";
        sr.onresult = (event: any) => {
          if (!mountedRef.current) return;
          let interim = "";
          let final = "";
          for (let i = event.resultIndex; i < event.results.length; i++) {
            if (event.results[i].isFinal) {
              final += event.results[i][0].transcript + " ";
            } else {
              interim += event.results[i][0].transcript;
            }
          }
          if (final) setTranscript((prev) => (prev + final).trimStart());
          setInterimTranscript(interim);
        };
        sr.onerror = (e: any) => {
          if (e.error !== "no-speech") console.warn("SpeechRecognition:", e.error);
        };
        sr.onend = () => {
          // Chrome stops after ~60 s of silence — restart if still recording
          if (mountedRef.current && mediaRecorderRef.current && speechRecognitionRef.current) {
            try { speechRecognitionRef.current.start(); } catch {}
          }
        };
        sr.start();
        speechRecognitionRef.current = sr;
      } catch (e) {
        console.warn("SpeechRecognition unavailable:", e);
      }
    }
    // --- end live transcript ---

    if (!streamRef.current) {
      console.warn("startRecording: no media stream available");
      return;
    }

    const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
      ? "audio/webm;codecs=opus"
      : MediaRecorder.isTypeSupported("audio/webm")
        ? "audio/webm"
        : "audio/mp4";
    const audioOnlyStream = new MediaStream(streamRef.current.getAudioTracks());
    const mr = new MediaRecorder(audioOnlyStream, {
      mimeType,
      audioBitsPerSecond: 32000,
    });
    const chunks: Blob[] = [];
    mr.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data);
    };
    const currentQ = questionIndex + 1;
    mr.onstop = async () => {
      const blob = new Blob(chunks, { type: mimeType });

      // Optionally save local copy if file system access was granted
      const dirHandle = getVideoDirHandle();
      if (dirHandle) {
        try {
          const fileHandle = await dirHandle.getFileHandle(`question-${currentQ}.webm`, {
            create: true,
          });
          const writable = await fileHandle.createWritable();
          await writable.write(blob);
          await writable.close();
        } catch (e) {
          console.warn(`Failed to save local video for Q${currentQ}`, e);
        }
      }

      // Always send for transcription
      handleRecordingComplete(blob);
    };
    mr.start(1000); // chunk every second
    mediaRecorderRef.current = mr;
  }

  const handleRecordingComplete = useCallback(async (audioBlob: Blob) => {
    if (!mountedRef.current || interviewCancelledRef.current) return;
    setTranscribing(true);
    try {
      console.log("Uploading audio for transcription...");
      const rawTranscription = await api.transcribeAudio(audioBlob) as {
        text?: string;
        transcript?: string;
        language?: string;
        duration?: number;
      };
      console.log("RAW TRANSCRIBE RESPONSE:", rawTranscription);

      const parsedTranscript = rawTranscription.text ?? rawTranscription.transcript ?? "";
      console.log("PARSED TRANSCRIPT:", parsedTranscript);
      
      // Update transcript state
      console.log("UPDATING UI WITH:", parsedTranscript);
      setTranscript(parsedTranscript);
      setInterimTranscript("");
      
      // Submit IMMEDIATELY via ref (no countdown, no effect indirection — avoids stale closures)
      // Fall back to browser SpeechRecognition if Whisper returned empty
      const toSubmit = (parsedTranscript || transcriptRef.current || interimTranscriptRef.current).trim();
      setTranscribing(false);
      handleNextRef.current?.(toSubmit);
      return;
    } catch (error) {
      console.error("Transcription failed:", error);
      // Still submit with whatever the browser captured — do NOT freeze the interview
      const fallback = (transcriptRef.current || interimTranscriptRef.current).trim();
      setInterimTranscript(fallback ? "" : "Could not transcribe audio.");
      setTranscribing(false);
      handleNextRef.current?.(fallback);
    } finally {
      setTranscribing(false);
    }
  }, []); // no deps — data stored in refs, handleNext invoked via ref

  const playQuestionAudio = useCallback(async (text: string, isReplay = false) => {
    if (!mountedRef.current || ttsPlayingRef.current || interviewCancelledRef.current) {
      console.log("Cannot play TTS - unmounted, cancelled, or already playing");
      return;
    }

    // Stop any existing audio BEFORE setting the playing flag
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.onended = null;
      audioRef.current.onerror = null;
      audioRef.current = null;
    }
    window.speechSynthesis.cancel();
    
    console.log("Starting TTS playback");
    setSpeaking(true);
    ttsPlayingRef.current = true;

    const finishPlayback = () => {
      if (!mountedRef.current) return;
      setSpeaking(false);
      ttsPlayingRef.current = false;
      if (!isReplay && !recording && !mediaRecorderRef.current && !interviewCancelledRef.current) {
        inSpeakingDelay.current = true;
        setSpeakingDelay(SPEAKING_DELAY_SECONDS);
      }
    };

    const speakWithBrowser = async () => {
      await new Promise<void>((resolve) => {
        ttsPlaybackResolveRef.current = resolve;
        try {
          const utterance = new SpeechSynthesisUtterance(text);
          utterance.onend = () => {
            if (!mountedRef.current) return resolve();
            console.log("Speech synthesis ended");
            finishPlayback();
            if (ttsPlaybackResolveRef.current === resolve) ttsPlaybackResolveRef.current = null;
            resolve();
          };
          utterance.onerror = (e) => {
            console.error("Speech synthesis error", e);
            finishPlayback();
            if (ttsPlaybackResolveRef.current === resolve) ttsPlaybackResolveRef.current = null;
            resolve();
          };
          window.speechSynthesis.speak(utterance);
        } catch (synthError) {
          console.error("Speech synthesis fallback failed", synthError);
          finishPlayback();
          if (ttsPlaybackResolveRef.current === resolve) ttsPlaybackResolveRef.current = null;
          resolve();
        }
      });
    };
    
    try {
      const url = await api.getTtsAudioUrl(text, interviewer.voice);
      
      if (!mountedRef.current || interviewCancelledRef.current) {
        console.log("Component unmounted or cancelled during TTS fetch");
        return;
      }
      
      await new Promise<void>((resolve) => {
        ttsPlaybackResolveRef.current = resolve;
        const audio = new Audio(url);
        audioRef.current = audio;

        audio.onended = () => {
          if (!mountedRef.current) return resolve();
          console.log("TTS playback ended");
          audioRef.current = null;
          finishPlayback();
          if (ttsPlaybackResolveRef.current === resolve) ttsPlaybackResolveRef.current = null;
          resolve();
        };

        audio.onerror = (e) => {
          console.error("TTS audio error", e);
          audioRef.current = null;
          if (ttsPlaybackResolveRef.current === resolve) ttsPlaybackResolveRef.current = null;
          void speakWithBrowser().finally(resolve);
        };

        const playPromise = audio.play();
        if (playPromise !== undefined) {
          playPromise.catch((e: any) => {
            if (e.name === "AbortError") return;
            console.error("Audio play error:", e);
            audioRef.current = null;
            void speakWithBrowser().finally(resolve);
          });
        }
      });
    } catch (e) {
      console.error("TTS failed, fallback to synthesis", e);
      if (!mountedRef.current || interviewCancelledRef.current) return;
      await speakWithBrowser();
    }
  }, [interviewer, recording, cleanupInterviewAudioState]);

  const completeInterviewSession = useCallback(async () => {
    if (!iv || interviewCancelledRef.current || finalizingInterviewRef.current) return;
    finalizingInterviewRef.current = true;
    try {
      const updated = await api.completeInterview(iv.id);
      if (mountedRef.current) setIv(updated);
    } catch (error) {
      console.error("Failed to complete interview:", error);
    } finally {
      if (mountedRef.current) {
        finalizingInterviewRef.current = false;
      }
    }
  }, [iv]);

  // Start conversational interview
  const startConversationalInterview = useCallback(async () => {
    try {
      const response = await api.conversationalInterview({
        phase: interviewPhase,
        interviewer_name: interviewer.name,
        interviewer_title: interviewer.title,
        interviewer_tone: interviewer.tone,
        interviewer_specialty: interviewer.specialty,
        interview_type: iv?.interviewType || "Technical",
        job_role: iv?.jobRole || "Software Engineer",
        candidate_name: candidateName || undefined,
        resume_summary: resumeSummary,
        candidate_field: resumeField,
        generated_questions: iv?.questions?.map(q => q.prompt) || [],
        question_index: questionIndex,
        conversation_history: conversationHistory,
        warmup_questions_asked: warmupQuestionsAsked,
        exchange_count: exchangeCount,
      });

      if (!mountedRef.current || interviewCancelledRef.current || finalizingInterviewRef.current) return;

      // Add AI response to conversation history
      const newHistory = [...conversationHistory, { role: "assistant", content: response.response }];
      setConversationHistory(newHistory);

      // Play AI response via TTS
      await playQuestionAudio(response.response, false);

      if (!mountedRef.current || interviewCancelledRef.current || finalizingInterviewRef.current) return;

      // Update phase based on exchange
      const nextPhase = getNextPhase(interviewPhase, exchangeCount + 1, warmupQuestionsAsked, iv?.questions?.length || 0);
      setInterviewPhase(nextPhase);
      setExchangeCount(exchangeCount + 1);

    } catch (error) {
      console.error("Conversational interview error:", error);
    }
  }, [interviewPhase, interviewer, iv, candidateName, conversationHistory, warmupQuestionsAsked, exchangeCount, resumeSummary, resumeField, questionIndex, playQuestionAudio, getNextPhase]);

  // Handle candidate response
  const handleCandidateResponse = useCallback(async (candidateInput: string) => {
    try {
      if (interviewCancelledRef.current || finalizingInterviewRef.current) return;

      // Add candidate input to conversation history
      const newHistory = [...conversationHistory, { role: "user", content: candidateInput }];
      setConversationHistory(newHistory);

      // Extract candidate name if in SMALL_TALK phase and name not known
      if (interviewPhase === "SMALL_TALK" && !candidateName) {
        // TODO: Add name extraction logic
        // const extractedName = await extractCandidateName(response.response, candidateInput);
        // if (extractedName) setCandidateName(extractedName);
      }

      // Get AI response
      const response = await api.conversationalInterview({
        phase: interviewPhase,
        interviewer_name: interviewer.name,
        interviewer_title: interviewer.title,
        interviewer_tone: interviewer.tone,
        interviewer_specialty: interviewer.specialty,
        interview_type: iv?.interviewType || "Technical",
        job_role: iv?.jobRole || "Software Engineer",
        candidate_name: candidateName || undefined,
        resume_summary: resumeSummary,
        candidate_field: resumeField,
        generated_questions: iv?.questions?.map(q => q.prompt) || [],
        question_index: questionIndex,
        conversation_history: newHistory,
        candidate_input: candidateInput,
        warmup_questions_asked: warmupQuestionsAsked,
        exchange_count: exchangeCount + 1,
      });

      if (!mountedRef.current || interviewCancelledRef.current || finalizingInterviewRef.current) return;

      // Add AI response to conversation history
      const updatedHistory = [...newHistory, { role: "assistant", content: response.response }];
      setConversationHistory(updatedHistory);

      // Play AI response via TTS
      await playQuestionAudio(response.response, false);

      if (!mountedRef.current || interviewCancelledRef.current || finalizingInterviewRef.current) return;

      // Advance question index in CORE_QUESTIONS so the AI asks the next question
      const totalQ = iv?.questions?.length || 0;
      let nextQIdx = questionIndex;
      if (interviewPhase === "CORE_QUESTIONS") {
        nextQIdx = questionIndex + 1;
        setQuestionIndex(nextQIdx);
      }

      // Compute next phase using updated question index
      let nextPhase: InterviewPhase;
      if (interviewPhase === "CORE_QUESTIONS") {
        nextPhase = nextQIdx >= totalQ ? "CLOSING" : "CORE_QUESTIONS";
      } else {
        nextPhase = getNextPhase(interviewPhase, exchangeCount + 2, warmupQuestionsAsked, totalQ);
      }
      if (nextPhase === "CLOSING" && interviewPhase !== "CLOSING") {
        setClosingTurnCount(0);
      }
      setInterviewPhase(nextPhase);
      setExchangeCount(exchangeCount + 2);

      if (interviewPhase === "BACKGROUND") {
        setWarmupQuestionsAsked(warmupQuestionsAsked + 1);
      }

      if (interviewPhase === "CLOSING") {
        const nextClosingTurnCount = closingTurnCount + 1;
        setClosingTurnCount(nextClosingTurnCount);
        if (nextClosingTurnCount >= 2) {
          await completeInterviewSession();
        }
      }

    } catch (error) {
      console.error("Candidate response error:", error);
    }
  }, [interviewPhase, interviewer, iv, candidateName, conversationHistory, warmupQuestionsAsked, exchangeCount, resumeSummary, resumeField, questionIndex, closingTurnCount, playQuestionAudio, getNextPhase, completeInterviewSession]);

  // Trigger greeting once interview becomes in_progress — placed after all useCallbacks to avoid forward reference
  useEffect(() => {
    if (iv?.status === "in_progress") {
      interviewActiveRef.current = true;
      console.log("Interview is active");
    } else {
      interviewActiveRef.current = false;
      console.log("Interview is inactive");
    }

    if (iv?.status === "in_progress" && interviewPhase === "GREETING" && !greetingStarted.current) {
      greetingStarted.current = true;
      console.log("Starting interview greeting");
      startConversationalInterview();
    }
  }, [iv?.status, interviewPhase, startConversationalInterview]);

  async function handleStart() {
    if (!iv) return;
    setSubmitting(true);
    try {
      const updated = await api.startInterview(iv.id);
      setIv(updated);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleNext(overrideTranscript?: string) {
    if (!iv || !mountedRef.current || submitting || interviewCancelledRef.current || finalizingInterviewRef.current) {
      console.log("handleNext blocked - iv:", !!iv, "mounted:", mountedRef.current, "submitting:", submitting, "cancelled:", interviewCancelledRef.current, "finalizing:", finalizingInterviewRef.current);
      return;
    }

    // If still recording and no Whisper result yet, stop the recorder.
    // MediaRecorder.onstop → handleRecordingComplete → Whisper → auto-submit will take over.
    if (recording && overrideTranscript === undefined) {
      stopRecording();
      return;
    }

    // Cancel any pending auto-submit timer
    if (autoSubmitTimerRef.current) {
      clearTimeout(autoSubmitTimerRef.current);
      autoSubmitTimerRef.current = null;
    }
    pendingAutoSubmitRef.current = null;
    
    // Prevent rapid spam
    setSubmitting(true);
    
    try {
      // For conversational interview, handle candidate response
      const finalText = (overrideTranscript ?? transcript).trim();
      if (finalText.length > 0) {
        console.log("CURRENT CHAT STATE:", conversationHistory);
        console.log("Submitting candidate response:", finalText.substring(0, 50) + "...");
        await handleCandidateResponse(finalText);
      } else if (interviewPhase === "CLOSING") {
        console.log("No closing transcript — completing interview");
        await completeInterviewSession();
      } else {
        console.log("No transcript to submit, continuing");
      }
      
      // Reset transcript only — do NOT cleanupInterviewAudioState here;
      // TTS manages its own lifecycle via onended and we must not pause mid-play.
      setTranscript("");
      setInterimTranscript("");
      setSecondsLeft(QUESTION_SECONDS);
      
    } catch (error) {
      console.error("Error in handleNext:", error);
    } finally {
      if (mountedRef.current) {
        setSubmitting(false);
      }
    }
  }

  // Keep ref pointing at latest handleNext so async callbacks (Whisper finish, MediaRecorder onstop)
  // always invoke the freshest closure with current state.
  handleNextRef.current = handleNext;

  if (loading) return <FullPageLoading />;
  if (error || !iv) return <FullPageError message={error ?? "Interview not found"} />;

  if (iv.status === "cancelled") return <FullPageError message="This interview was cancelled because the session lost focus or switched tabs. Please start a new interview from the dashboard." />;

  if (iv.status === "completed") return <ResultsView iv={iv} interviewer={interviewer} interviewPhase={interviewPhase} exchangeCount={exchangeCount} conversationHistory={conversationHistory} />;

  const inSession = iv.status === "in_progress";
  const currentAIMessage = conversationHistory[conversationHistory.length - 1]?.content || "";
  const progressPct = ((exchangeCount + (recording ? 0.5 : 0)) / 20) * 100; // Estimate 20 exchanges total

  return (
    <div className="relative min-h-screen overflow-hidden">
      <div className="pointer-events-none absolute inset-0 grid-bg opacity-30" />

      <header className="relative z-10 border-b border-border bg-background/70 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1500px] items-center justify-between gap-4 px-6 py-3.5">
          <div className="flex items-center gap-4">
            <Link to="/dashboard">
              <Logo />
            </Link>
            <span className="hidden h-5 w-px bg-border md:block" />
            <div className="hidden md:block">
              <div className="text-xs uppercase tracking-wider text-muted-foreground">
                {iv.interviewType}
              </div>
              <div className="text-sm font-medium leading-tight">{iv.jobRole}</div>
            </div>
            {inSession && (
              <>
                <span className="hidden h-5 w-px bg-border md:block" />
                <div className="flex items-center gap-3 rounded-full border border-border bg-elevated/40 px-3 py-1.5 shadow-sm backdrop-blur">
                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-primary text-xs font-bold text-white">
                    {interviewer.name.charAt(0)}
                  </div>
                  <div className="hidden md:block">
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{interviewer.title}</div>
                    <div className="text-xs font-semibold">{interviewer.name}</div>
                  </div>
                </div>
              </>
            )}
          </div>
          <div className="flex items-center gap-3">
            {inSession && (
              <div className="hidden items-center gap-2 rounded-full border border-border bg-elevated/60 px-3 py-1 text-xs md:flex">
                <span
                  className={`h-2 w-2 rounded-full ${
                    recording ? "bg-destructive recording-pulse" : 
                    speakingDelay > 0 ? "bg-warning animate-pulse" : 
                    "bg-muted-foreground"
                  }`}
                />
                {recording ? "Recording" : speakingDelay > 0 ? `Get ready... ${speakingDelay}` : "Paused"}
              </div>
            )}
            <Link to="/dashboard">
              <Button variant="ghost" size="sm">
                Exit
              </Button>
            </Link>
          </div>
        </div>
        {inSession && (
          <div className="h-0.5 w-full bg-elevated">
            <div
              className="h-full bg-gradient-primary transition-all duration-300"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        )}
      </header>

      {!inSession ? (
        <ReadyView iv={iv} onStart={handleStart} loading={submitting} />
      ) : (
        <main className="relative z-10 mx-auto grid max-w-[1500px] grid-cols-1 gap-5 px-4 py-6 lg:grid-cols-[1fr_440px] lg:px-6">
          {/* Camera + transcription */}
          <section className="space-y-4">
            <div className="relative aspect-video overflow-hidden rounded-2xl border border-border bg-black shadow-elegant">
              <video
                ref={videoRef}
                autoPlay
                muted
                playsInline
                className="absolute inset-0 h-full w-full scale-x-[-1] object-cover"
              />
              <div className="absolute inset-x-0 top-0 z-10 flex items-center justify-between p-4">
                <div className="flex items-center gap-2 rounded-full border border-white/15 bg-black/40 px-3 py-1.5 text-[11px] font-medium uppercase tracking-wider text-white backdrop-blur">
                  <span
                    className={`h-2 w-2 rounded-full ${
                      recording ? "bg-destructive recording-pulse" : 
                      speakingDelay > 0 ? "bg-warning animate-pulse" : 
                      "bg-white/50"
                    }`}
                  />
                  {recording ? "Live" : speakingDelay > 0 ? `Get ready... ${speakingDelay}` : "Standby"}
                </div>
                <div className="rounded-full border border-white/15 bg-black/40 px-3 py-1.5 font-mono text-xs text-white backdrop-blur">
                  Q {questionIndex + 1} / {iv.questions.length}
                </div>
              </div>
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/30" />
              <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-4 p-5">
                <div className="rounded-xl border border-white/10 bg-black/50 px-4 py-3 backdrop-blur">
                  <div className="text-[10px] uppercase tracking-wider text-white/60">
                    Time remaining
                  </div>
                  <div className="font-mono text-2xl font-semibold text-white tabular-nums">
                    {formatTime(secondsLeft)}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button size="lg" variant="outline" onClick={() => playQuestionAudio(currentAIMessage, true)} disabled={speaking || submitting}>
                    {speaking ? "Speaking..." : "Replay"}
                  </Button>
                  {!recording ? (
                    <Button size="lg" onClick={startRecording} disabled={speaking || speakingDelay > 0 || submitting}>
                      {speaking ? "Speaking..." : speakingDelay > 0 ? `Get ready... ${speakingDelay}` : "● Start answering"}
                    </Button>
                  ) : (
                    <Button size="lg" variant="destructive" onClick={stopRecording}>
                      Stop
                    </Button>
                  )}
                  <Button size="lg" variant="secondary" onClick={() => handleNext()} loading={submitting}>
                    {questionIndex === iv.questions.length - 1 ? "Finish ↗" : "Next →"}
                  </Button>
                </div>
              </div>
            </div>

            <div className="surface-card p-5">
              <div className="mb-2 flex items-center justify-between text-xs">
                <span className="uppercase tracking-wider text-muted-foreground">
                  Live transcript
                </span>
                {submitting ? (
                  <span className="flex items-center gap-1.5 text-muted-foreground">
                    <span className="h-2 w-2 animate-spin rounded-full border border-current border-t-transparent" />
                    Sending…
                  </span>
                ) : transcribing ? (
                  <span className="flex items-center gap-1.5 text-blue-400 text-xs">
                    <span className="h-2 w-2 animate-spin rounded-full border border-current border-t-transparent" />
                    Transcribing…
                  </span>
                ) : (
                  <span className="font-mono text-muted-foreground">
                    {(transcript + interimTranscript).split(/\s+/).filter(Boolean).length} words
                  </span>
                )}
              </div>
              <div className="min-h-[120px] rounded-lg border border-border bg-elevated/40 p-4 text-sm leading-relaxed">
                {transcript || interimTranscript ? (
                  <>
                    <span>{transcript}</span>
                    <span className="text-muted-foreground">
                      {interimTranscript ? " " + interimTranscript : ""}
                    </span>
                  </>
                ) : (
                  <span className="text-muted-foreground">
                    Press <span className="text-foreground">Start answering</span> — your words will
                    appear here as you speak. A final accurate transcript is processed when you stop.
                  </span>
                )}
              </div>
            </div>
          </section>

          {/* Question + steps */}
          <aside className="space-y-4">
            <div className="surface-card p-6">
              <div className="flex items-start justify-between gap-3">
                <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
                  {interviewPhase} Phase
                </div>
                <span className="rounded-full border border-border bg-elevated/60 px-2 py-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">
                  Exchange {exchangeCount}
                </span>
              </div>
              <h2 className="mt-3 text-xl font-medium leading-snug tracking-tight">
                {speaking && <span className="mr-2 inline-block h-2 w-2 animate-pulse rounded-full bg-primary" />}
                {currentAIMessage || "Listening..."}
              </h2>
              <div className="mt-5 rounded-lg border border-border bg-elevated/40 p-3 text-xs text-muted-foreground">
                Tip: Aim for 60–120 seconds. Lead with structure, then specifics.
              </div>
            </div>

            <div className="surface-card p-5">
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
                Progress
              </div>
              <ol className="mt-3 space-y-2">
                {[
                  { phase: "GREETING", description: "Welcome & introduction", completed: exchangeCount > 0 },
                  { phase: "SMALL_TALK", description: "Get to know you", completed: exchangeCount > 3 },
                  { phase: "AGENDA", description: "Session overview", completed: exchangeCount > 4 },
                  { phase: "BACKGROUND", description: "Experience warmup", completed: warmupQuestionsAsked >= 2 },
                  { phase: "CORE_QUESTIONS", description: "Main interview", completed: interviewPhase === "CLOSING" },
                  { phase: "CLOSING", description: "Wrap up & questions", completed: false },
                ].map((step, i) => {
                  const active = interviewPhase === step.phase;
                  return (
                    <li
                      key={step.phase}
                      className={`flex items-start gap-3 rounded-lg border px-3 py-2 text-xs transition-colors ${
                        active ? "border-primary/50 bg-primary/5" : "border-border bg-elevated/30"
                      }`}
                    >
                      <span
                        className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full text-[10px] font-semibold ${
                          step.completed
                            ? "bg-success text-background"
                            : active
                              ? "bg-gradient-primary text-primary-foreground"
                              : "bg-elevated text-muted-foreground"
                        }`}
                      >
                        {step.completed ? "✓" : i + 1}
                      </span>
                      <span
                        className={`line-clamp-2 ${active ? "text-foreground" : "text-muted-foreground"}`}
                      >
                        {step.description}
                      </span>
                    </li>
                  );
                })}
              </ol>
            </div>
          </aside>
        </main>
      )}
    </div>
  );
}

function formatTime(s: number) {
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, "0")}`;
}

function ReadyView({
  iv,
  onStart,
  loading,
}: {
  iv: Interview;
  onStart: () => void;
  loading: boolean;
}) {
  return (
    <main className="relative z-10 mx-auto grid max-w-3xl place-items-center px-6 py-16 text-center">
      <div className="surface-card w-full p-10 shadow-elegant">
        <div className="mx-auto mb-5 inline-flex items-center gap-2 rounded-full border border-border bg-elevated/60 px-3 py-1 text-xs text-muted-foreground">
          <span className="h-1.5 w-1.5 rounded-full bg-accent" /> {iv.interviewType} interview
        </div>
        <h1 className="text-balance text-3xl font-semibold tracking-tight md:text-4xl">
          {iv.jobRole}
        </h1>
        <p className="mx-auto mt-3 max-w-md text-sm text-muted-foreground">
          {iv.questions.length} questions · ~{Math.round(iv.questions.length * 2.5)} minutes. We'll
          request access to your camera and microphone when you start.
        </p>
        <div className="mt-8 grid grid-cols-3 gap-3 text-left">
          {[
            { k: "Camera", v: "Required" },
            { k: "Microphone", v: "Required" },
            { k: "Per-question time", v: "2 min" },
          ].map((r) => (
            <div key={r.k} className="rounded-lg border border-border bg-elevated/40 p-3">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                {r.k}
              </div>
              <div className="mt-1 text-sm font-medium">{r.v}</div>
            </div>
          ))}
        </div>
        <div className="mt-8 flex items-center justify-center gap-2">
          <Link to="/dashboard">
            <Button variant="outline" size="lg">
              Cancel
            </Button>
          </Link>
          <Button size="lg" loading={loading} onClick={onStart}>
            Begin interview →
          </Button>
        </div>
      </div>
    </main>
  );
}

function ResultsView({ iv, interviewer, interviewPhase, exchangeCount, conversationHistory }: { 
  iv: Interview; 
  interviewer: typeof INTERVIEWERS[0]; 
  interviewPhase: InterviewPhase; 
  exchangeCount: number; 
  conversationHistory: Array<{role: string, content: string}>; 
}) {
  return (
    <div className="relative min-h-screen">
      <header className="border-b border-border bg-background/70 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1200px] items-center justify-between px-6 py-3.5">
          <Link to="/dashboard">
            <Logo />
          </Link>
          <Link to="/dashboard/interviews">
            <Button variant="ghost" size="sm">
              All interviews
            </Button>
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-[1200px] px-6 py-10 space-y-8">
        <div className="flex flex-col items-start justify-between gap-6 md:flex-row md:items-end">
          <div>
            <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
              {iv.interviewType} · Completed
            </div>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight md:text-4xl">{iv.jobRole}</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {iv.completedAt ? new Date(iv.completedAt).toLocaleString() : ""}
            </p>
          </div>
          <div className="surface-card flex items-center gap-5 p-5">
            <ScoreRing value={iv.score ?? 0} size={84} />
            <div>
              <div className="text-xs uppercase tracking-wider text-muted-foreground">
                Final score
              </div>
              <div className="text-2xl font-semibold tracking-tight">
                {iv.score ?? "—"}
                <span className="text-sm text-muted-foreground"> / 100</span>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <div className="surface-card p-5">
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
              Interview Summary
            </div>
            <div className="mt-3 text-sm text-foreground/85">
              <div className="mb-2">
                <strong>Interviewer:</strong> {interviewer.name} ({interviewer.title})
              </div>
              <div className="mb-2">
                <strong>Total Exchanges:</strong> {exchangeCount}
              </div>
              <div className="mb-2">
                <strong>Final Phase:</strong> {interviewPhase}
              </div>
              <div>
                <strong>Conversation History:</strong> {conversationHistory.length} messages exchanged
              </div>
            </div>
          </div>
          
          {/* Show conversation transcript */}
          <div className="surface-card p-5">
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
              Full Conversation
            </div>
            <div className="mt-3 space-y-3 max-h-96 overflow-y-auto">
              {conversationHistory.map((msg: {role: string, content: string}, i: number) => (
                <div key={i} className={`text-sm ${msg.role === 'assistant' ? 'text-foreground' : 'text-muted-foreground'}`}>
                  <div className="font-medium text-xs uppercase tracking-wider mb-1">
                    {msg.role === 'assistant' ? interviewer.name : 'You'}
                  </div>
                  <div className="bg-elevated/40 rounded p-2">
                    {msg.content}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="flex justify-center pt-4">
          <Link to="/dashboard/practice">
            <Button size="lg">Run another interview →</Button>
          </Link>
        </div>
      </main>
    </div>
  );
}

function FullPageLoading() {
  return (
    <div className="grid min-h-screen place-items-center text-sm text-muted-foreground">
      <div className="flex items-center gap-3">
        <span className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />{" "}
        Loading interview…
      </div>
    </div>
  );
}
function FullPageError({ message }: { message: string }) {
  return (
    <div className="grid min-h-screen place-items-center px-6 text-center">
      <div>
        <h1 className="text-xl font-semibold">Couldn't load interview</h1>
        <p className="mt-2 text-sm text-muted-foreground">{message}</p>
        <div className="mt-4 flex items-center justify-center gap-2">
          <Button variant="outline" onClick={() => window.location.reload()}>
            Retry
          </Button>
          <Link to="/dashboard">
            <Button>Back to dashboard</Button>
          </Link>
        </div>
      </div>
    </div>
  );
}

function getVideoDirHandle(): FileSystemDirectoryHandle | null {
  const win = window as Window & { __videoDirHandle?: FileSystemDirectoryHandle };
  return win.__videoDirHandle ?? null;
}
