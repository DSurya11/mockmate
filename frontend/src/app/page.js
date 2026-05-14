'use client';
import { useRouter } from 'next/navigation';
import styles from './page.module.css';

export default function Home() {
  const router = useRouter();

  return (
    <div className={styles.landing}>
      {/* Animated orbs */}
      <div className={styles.orb1}></div>
      <div className={styles.orb2}></div>
      <div className={styles.orb3}></div>

      {/* Navbar */}
      <nav className={styles.navbar}>
        <div className={styles.navLogo}>
          <span className={styles.logoIcon}>⬡</span>
          <span className={styles.logoText}>InterviewAI</span>
        </div>
        <div className={styles.navLinks}>
          <a href="#features">Features</a>
          <a href="#how-it-works">How It Works</a>
          <a href="#stats">Impact</a>
          <button className="btn btn-ghost" onClick={() => router.push('/login')}>Sign In</button>
          <button className="btn btn-primary" onClick={() => router.push('/register')}>Get Started</button>
        </div>
      </nav>

      {/* Hero */}
      <section className={styles.hero}>
        <div className={styles.heroBadge}>
          <span className={styles.pulse}></span>
          AI-Powered Platform
        </div>
        <h1 className={styles.heroTitle}>
          Master Your Interviews<br />
          <span className={styles.gradientText}>With AI Precision</span>
        </h1>
        <p className={styles.heroSubtitle}>
          Upload your resume, get AI analysis, practice with intelligent mock interviews,
          receive real-time feedback, and track your improvement — all in one platform.
        </p>
        <div className={styles.heroCta}>
          <button className="btn btn-primary btn-lg" onClick={() => router.push('/register')}>
            Start Free Interview →
          </button>
          <button className="btn btn-secondary btn-lg" onClick={() => router.push('/login')}>
            Watch Demo
          </button>
        </div>

        {/* Stats strip */}
        <div className={styles.statsStrip}>
          <div className={styles.statItem}>
            <span className={styles.statNum}>50K+</span>
            <span className={styles.statDesc}>Interviews Conducted</span>
          </div>
          <div className={styles.statDivider}></div>
          <div className={styles.statItem}>
            <span className={styles.statNum}>94%</span>
            <span className={styles.statDesc}>Success Rate</span>
          </div>
          <div className={styles.statDivider}></div>
          <div className={styles.statItem}>
            <span className={styles.statNum}>2.5s</span>
            <span className={styles.statDesc}>Avg AI Response</span>
          </div>
          <div className={styles.statDivider}></div>
          <div className={styles.statItem}>
            <span className={styles.statNum}>500+</span>
            <span className={styles.statDesc}>Companies Trust Us</span>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className={styles.features}>
        <h2 className={styles.sectionTitle}>
          Everything You Need to <span className={styles.gradientText}>Ace Your Interview</span>
        </h2>
        <p className={styles.sectionSubtitle}>
          From resume optimization to live interview simulation — powered by advanced AI
        </p>

        <div className={styles.featureGrid}>
          <div className={styles.featureCard}>
            <div className={styles.featureIcon}>📄</div>
            <h3>AI Resume Analysis</h3>
            <p>Upload your resume and get instant ATS scoring, skill extraction, and actionable improvement suggestions.</p>
          </div>
          <div className={styles.featureCard}>
            <div className={styles.featureIcon}>🎯</div>
            <h3>Smart Question Generation</h3>
            <p>AI generates role-specific questions based on your resume, job role, and difficulty preference.</p>
          </div>
          <div className={styles.featureCard}>
            <div className={styles.featureIcon}>🎙️</div>
            <h3>Speech-to-Text</h3>
            <p>Answer questions naturally with voice. Real-time transcription captures every word for AI analysis.</p>
          </div>
          <div className={styles.featureCard}>
            <div className={styles.featureIcon}>🧠</div>
            <h3>LLM Evaluation Engine</h3>
            <p>Advanced AI scores your technical accuracy, communication clarity, and confidence level.</p>
          </div>
          <div className={styles.featureCard}>
            <div className={styles.featureIcon}>📊</div>
            <h3>Analytics Dashboard</h3>
            <p>Track improvement trends, identify weak areas, and see detailed score breakdowns over time.</p>
          </div>
          <div className={styles.featureCard}>
            <div className={styles.featureIcon}>🔴</div>
            <h3>Live Interview Rooms</h3>
            <p>Real-time video rooms with WebRTC, chat, live transcript, and collaborative interview experience.</p>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className={styles.howItWorks}>
        <h2 className={styles.sectionTitle}>
          How <span className={styles.gradientText}>InterviewAI</span> Works
        </h2>
        <div className={styles.steps}>
          <div className={styles.step}>
            <div className={styles.stepNum}>01</div>
            <h3>Upload Resume</h3>
            <p>Upload your PDF resume. Our AI extracts skills, experience, and generates a comprehensive ATS score.</p>
          </div>
          <div className={styles.stepConnector}></div>
          <div className={styles.step}>
            <div className={styles.stepNum}>02</div>
            <h3>Start Interview</h3>
            <p>Choose your target role and difficulty. AI generates personalized questions tailored to your profile.</p>
          </div>
          <div className={styles.stepConnector}></div>
          <div className={styles.step}>
            <div className={styles.stepNum}>03</div>
            <h3>Answer & Record</h3>
            <p>Answer questions via voice or text. Speech-to-text captures your responses in real-time.</p>
          </div>
          <div className={styles.stepConnector}></div>
          <div className={styles.step}>
            <div className={styles.stepNum}>04</div>
            <h3>Get AI Feedback</h3>
            <p>Receive detailed scores, feedback, and improvement tips powered by advanced language models.</p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className={styles.footer}>
        <div className={styles.footerInner}>
          <div className={styles.footerBrand}>
            <span className={styles.logoIcon}>⬡</span>
            <span className={styles.logoText}>InterviewAI</span>
            <p className={styles.footerDesc}>AI-powered interview evaluation platform for the next generation of talent.</p>
          </div>
          <div className={styles.footerLinks}>
            <div>
              <h4>Product</h4>
              <a href="#features">Features</a>
              <a href="#how-it-works">How It Works</a>
              <a href="/register">Get Started</a>
            </div>
            <div>
              <h4>Platform</h4>
              <a href="/login">Candidate Portal</a>
              <a href="/login">Recruiter Portal</a>
              <a href="/login">Admin Panel</a>
            </div>
          </div>
        </div>
        <div className={styles.footerBottom}>
          <p>© 2026 InterviewAI. Built with ❤️ for better hiring.</p>
        </div>
      </footer>
    </div>
  );
}
