import './globals.css';

export const metadata = {
  title: 'InterviewAI — AI-Powered Interview Evaluation Platform',
  description: 'Complete AI-powered hiring platform with resume analysis, mock interviews, real-time evaluation, and advanced analytics. Built for candidates, recruiters, and enterprises.',
  keywords: 'AI interview, mock interview, resume analysis, hiring platform, interview evaluation',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
