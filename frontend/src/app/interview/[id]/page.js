'use client';
import { useEffect, useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import api from '@/lib/api';
import useAuthStore from '@/store/authStore';
import styles from '../../dashboard/dashboard.module.css';

export default function InterviewRoomPage() {
  const params = useParams();
  const id = params?.id;
  const router = useRouter();
  const { user, initialize, isAuthenticated, isLoading } = useAuthStore();
  const [interview, setInterview] = useState(null);
  const [currentQ, setCurrentQ] = useState(0);
  const [transcript, setTranscript] = useState('');
  const [liveText, setLiveText] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [answers, setAnswers] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [timer, setTimer] = useState(0);
  const [hasVideo, setHasVideo] = useState(false);
  const recognitionRef = useRef(null);
  const isRecordingRef = useRef(false);
  const timerRef = useRef(null);
  const videoRef = useRef(null);
  const streamRef = useRef(null);

  const parseMaybeJson = (value) => {
    if (!value) return value;
    if (typeof value === 'object') return value;
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  };

  const normalizeInterview = (data) => ({
    ...data,
    scoreBreakdown: parseMaybeJson(data.scoreBreakdown),
    questions: data.questions?.map((q) => ({
      ...q,
      answer: q.answer ? { ...q.answer, aiFeedback: parseMaybeJson(q.answer.aiFeedback) } : q.answer,
    })),
  });

  useEffect(() => { initialize(); }, [initialize]);
  useEffect(() => {
    if (!isLoading && !isAuthenticated) router.push('/login');
  }, [isLoading, isAuthenticated, router]);

  useEffect(() => {
    if (isAuthenticated && id) {
      api.get(`/interviews/${id}`).then((data) => {
        const normalized = normalizeInterview(data);
        setInterview(normalized);
        if (normalized.status === 'COMPLETED') setCompleted(true);
        // Pre-fill existing answers
        const existing = {};
        normalized.questions?.forEach(q => {
          if (q.answer) existing[q.id] = q.answer;
        });
        setAnswers(existing);
      }).catch(() => router.push('/dashboard'));
    }
  }, [isAuthenticated, id, router]);

  // Camera setup
  useEffect(() => {
    async function setupCamera() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
        setHasVideo(true);
      } catch (err) {
        console.log('Camera not available:', err);
        setHasVideo(false);
      }
    }
    setupCamera();
    return () => {
      streamRef.current?.getTracks().forEach(t => t.stop());
    };
  }, []);

  // Timer
  useEffect(() => {
    if (interview?.status === 'IN_PROGRESS' || isRecording) {
      timerRef.current = setInterval(() => setTimer(t => t + 1), 1000);
    }
    return () => clearInterval(timerRef.current);
  }, [interview?.status, isRecording]);

  const formatTime = (s) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
  };

  const startInterview = async () => {
    try {
      await api.patch(`/interviews/${id}/start`);
      setInterview(prev => ({ ...prev, status: 'IN_PROGRESS' }));
    } catch (err) {
      console.error('Failed to start interview', err);
    }
  };

  const startRecording = () => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      alert('Speech recognition not supported. Please use Chrome.');
      return;
    }
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onresult = (event) => {
      let interim = '';
      let final = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const t = event.results[i][0].transcript;
        if (event.results[i].isFinal) final += t + ' ';
        else interim = t;
      }
      if (final) setTranscript(prev => prev + final);
      setLiveText(interim);
    };

    recognition.onerror = (e) => {
      console.error('Speech error:', e.error);
      if (e.error !== 'no-speech') {
        setIsRecording(false);
        isRecordingRef.current = false;
      }
    };

    recognition.onend = () => {
      if (isRecordingRef.current) recognition.start(); // Auto-restart
    };

    recognition.start();
    recognitionRef.current = recognition;
    setIsRecording(true);
    isRecordingRef.current = true;
  };

  const stopRecording = () => {
    isRecordingRef.current = false;
    setIsRecording(false);
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    setLiveText('');
  };

  const submitAnswer = async () => {
    const question = interview.questions[currentQ];
    if (!transcript.trim()) return;
    setSubmitting(true);
    try {
      const answer = await api.post(`/interviews/questions/${question.id}/answer`, {
        transcript: transcript.trim(),
        durationSeconds: timer,
      });
      setAnswers(prev => ({ ...prev, [question.id]: answer }));
      setTranscript('');
      setTimer(0);

      if (currentQ < interview.questions.length - 1) {
        setCurrentQ(currentQ + 1);
      }
    } catch (err) {
      alert('Failed to submit answer');
    } finally {
      setSubmitting(false);
    }
  };

  const finishInterview = async () => {
    stopRecording();
    try {
      const result = await api.patch(`/interviews/${id}/complete`);
      setInterview(result);
      setCompleted(true);
    } catch (err) {
      alert('Failed to complete interview');
    }
  };

  if (isLoading || !interview) {
    return (
      <div className="loading-page">
        <div className="spinner"></div>
        <p className="text-muted">Loading interview...</p>
      </div>
    );
  }

  if (completed) {
    return (
      <div className="page-container" style={{ padding: 32 }}>
        <div style={{ maxWidth: 700, margin: '0 auto', textAlign: 'center', paddingTop: 60 }}>
          <div style={{ fontSize: '4rem', marginBottom: 24 }}>🎉</div>
          <h1 className="page-title" style={{ marginBottom: 12 }}>Interview Complete!</h1>
          <p className="page-subtitle mb-24">Your answers have been evaluated by AI</p>

          {interview.totalScore != null && (
            <div className="stat-card" style={{ maxWidth: 300, margin: '0 auto 32px', textAlign: 'center' }}>
              <div className="stat-value" style={{ fontSize: '3rem' }}>{Math.round(interview.totalScore)}%</div>
              <div className="stat-label">Overall Score</div>
            </div>
          )}

          {interview.scoreBreakdown && (
            <div className="card mb-24" style={{ textAlign: 'left' }}>
              <div className="card-header"><h3 className="card-title">Score Breakdown</h3></div>
              {Object.entries(interview.scoreBreakdown).filter(([k]) => !['questionsAnswered', 'totalQuestions'].includes(k)).map(([key, val]) => (
                <div key={key} style={{ marginBottom: 12 }}>
                  <div className={styles.breakdownLabel}>
                    <span>{key.charAt(0).toUpperCase() + key.slice(1)}</span>
                    <span className={styles.breakdownVal}>{Math.round(val)}%</span>
                  </div>
                  <div className="progress-bar"><div className="progress-fill" style={{ width: `${val}%` }}></div></div>
                </div>
              ))}
            </div>
          )}

          {/* Per-question feedback */}
          {interview.questions?.map((q, i) => (
            <div key={q.id} className="card mb-16" style={{ textAlign: 'left' }}>
              <div className="card-header">
                <h3 className="card-title">Q{i + 1}: {q.questionText}</h3>
                {q.answer?.overallScore != null && (
                  <span className={`badge ${q.answer.overallScore >= 70 ? 'badge-success' : q.answer.overallScore >= 50 ? 'badge-warning' : 'badge-error'}`}>
                    {Math.round(q.answer.overallScore)}%
                  </span>
                )}
              </div>
              {q.answer?.transcript && (
                <p className="text-sm text-muted" style={{ marginBottom: 8 }}>
                  <strong>Your answer:</strong> {q.answer.transcript.substring(0, 200)}{q.answer.transcript.length > 200 ? '...' : ''}
                </p>
              )}
              {q.answer?.aiFeedback?.summary && (
                <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{q.answer.aiFeedback.summary}</p>
              )}
            </div>
          ))}

          <div className="flex justify-center gap-16 mt-24">
            <button className="btn btn-primary" onClick={() => router.push('/dashboard')}>Back to Dashboard</button>
            <button className="btn btn-secondary" onClick={() => router.push('/interview/new')}>New Interview</button>
          </div>
        </div>
      </div>
    );
  }

  const question = interview.questions?.[currentQ];
  const isStarted = interview.status === 'IN_PROGRESS';

  return (
    <div className="page-container" style={{ padding: 24 }}>
      {/* Top bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div className="flex items-center gap-12">
          <button className="btn btn-ghost btn-sm" onClick={() => router.push('/dashboard')}>← Exit</button>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 700 }}>{interview.jobRole} Interview</h2>
          <span className={`badge ${isStarted ? 'badge-success' : 'badge-info'}`}>{interview.status}</span>
        </div>
        <div className="flex items-center gap-12">
          <span className="badge badge-accent">{formatTime(timer)}</span>
          <span className="text-sm text-muted">Q {currentQ + 1} / {interview.questions?.length || 0}</span>
        </div>
      </div>

      {!isStarted ? (
        <div style={{ textAlign: 'center', paddingTop: 100 }}>
          <div style={{ fontSize: '4rem', marginBottom: 20 }}>🎙️</div>
          <h2 className="page-title mb-8">Ready to begin?</h2>
          <p className="text-muted mb-24">You&apos;ll be asked {interview.questions?.length || 0} questions. Answer via voice or text.</p>
          <button className="btn btn-primary btn-lg" onClick={startInterview}>Start Interview →</button>
        </div>
      ) : (
        <div className={styles.interviewRoom}>
          {/* Video Area */}
          <div className={styles.videoArea}>
            <div className={styles.videoContainer}>
              <video 
                ref={videoRef} 
                autoPlay 
                muted 
                playsInline 
                style={{ display: hasVideo ? 'block' : 'none', width: '100%', height: '100%', objectFit: 'cover' }} 
              />
              {!hasVideo && (
                <div className={styles.videoPlaceholder}>
                  <span style={{ fontSize: '3rem', display: 'block', marginBottom: '8px' }}>🚫📹</span>
                  <p>Camera not available</p>
                  <p style={{ fontSize: '0.8rem', marginTop: '4px', color: 'var(--error)' }}>Please allow camera & mic permissions</p>
                </div>
              )}
            </div>
            <div className={styles.videoControls}>
              <button className={`${styles.controlBtn} ${isRecording ? styles.active : ''}`} onClick={isRecording ? stopRecording : startRecording} title={isRecording ? 'Stop Recording' : 'Start Recording'}>
                {isRecording ? '⏹' : '🎙️'}
              </button>
              <button className="btn btn-primary btn-sm" onClick={submitAnswer} disabled={!transcript.trim() || submitting}>
                {submitting ? 'Submitting...' : 'Submit Answer →'}
              </button>
              {currentQ > 0 && (
                <button className="btn btn-ghost btn-sm" onClick={() => { setCurrentQ(currentQ - 1); setTranscript(''); setTimer(0); }}>← Prev</button>
              )}
              {currentQ < (interview.questions?.length || 0) - 1 && answers[question?.id] && (
                <button className="btn btn-ghost btn-sm" onClick={() => { setCurrentQ(currentQ + 1); setTranscript(''); setTimer(0); }}>Next →</button>
              )}
              <button className={styles.controlBtnEnd} onClick={finishInterview} title="End Interview">📞</button>
            </div>
          </div>

          {/* Side Panel */}
          <div className={styles.sidePanel}>
            {question && (
              <div className={styles.questionPanel}>
                <div className={styles.questionNum}>Question {currentQ + 1} of {interview.questions.length}</div>
                <div className={styles.questionText}>{question.questionText}</div>
                <div className={styles.questionMeta}>
                  <span className="badge badge-accent">{question.category}</span>
                  <span className={`badge ${question.difficulty === 'EASY' ? 'badge-success' : question.difficulty === 'HARD' ? 'badge-error' : 'badge-warning'}`}>{question.difficulty}</span>
                </div>
                {answers[question.id] && (
                  <div style={{ marginTop: 16, padding: '12px', background: 'var(--success-bg)', borderRadius: 'var(--radius-sm)' }}>
                    <p className="text-sm" style={{ color: 'var(--success)' }}>✓ Answer submitted{answers[question.id].overallScore != null ? ` — Score: ${Math.round(answers[question.id].overallScore)}%` : ''}</p>
                  </div>
                )}
              </div>
            )}

            <div className={styles.transcriptPanel}>
              <div className={styles.transcriptTitle}>
                {isRecording && <span style={{ color: 'var(--error)', marginRight: 8 }}>● REC</span>}
                Live Transcript
              </div>
              <div className={styles.transcriptContent}>
                {transcript || <span className="text-muted">Start recording to see transcript...</span>}
                {liveText && <span className={styles.transcriptLive}>{liveText}</span>}
              </div>
              <textarea
                className="form-input mt-8"
                placeholder="Or type your answer here..."
                value={transcript}
                onChange={(e) => setTranscript(e.target.value)}
                rows={3}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
