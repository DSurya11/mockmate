const fs = require('fs');
const path = require('path');

const BASE_URL = 'http://localhost:5000/api';

async function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runTest() {
  console.log('--- STARTING E2E TEST ---');

  // 1. Register User
  const email = `testuser_${Date.now()}@mockmate.local`;
  console.log(`Registering user: ${email}`);
  const regRes = await fetch(`${BASE_URL}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Test Candidate',
      email,
      password: 'password123',
      role: 'CANDIDATE'
    })
  });
  
  if (!regRes.ok) {
    console.error('Registration failed', await regRes.text());
    return;
  }
  const { user, accessToken } = await regRes.json();
  console.log(`User registered: ${user.id}`);
  
  const headers = {
    'Authorization': `Bearer ${accessToken}`,
    'Content-Type': 'application/json'
  };

  // 2. Upload Resume (Create dummy PDF)
  const dummyPdfPath = path.join(__dirname, 'dummy_resume.pdf');
  // Just putting %PDF at the beginning to pass the signature check
  fs.writeFileSync(dummyPdfPath, '%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\nDummy resume content for testing purposes: Software Engineer with React and Node.js skills.');
  
  console.log('Uploading resume...');
  const formData = new FormData();
  formData.append('resume', new Blob([fs.readFileSync(dummyPdfPath)], { type: 'application/pdf' }), 'dummy_resume.pdf');
  
  const uploadRes = await fetch(`${BASE_URL}/resumes`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${accessToken}` },
    body: formData
  });

  if (!uploadRes.ok) {
    console.error('Upload failed', await uploadRes.text());
    return;
  }
  
  const resume = await uploadRes.json();
  console.log(`Resume uploaded: ${resume.id}`);

  // Wait for resume analysis to complete via BullMQ Worker -> AI Service
  console.log('Waiting for resume analysis...');
  let analyzedResume;
  for (let i = 0; i < 30; i++) { // wait up to 60 seconds
    const resumeCheck = await fetch(`${BASE_URL}/resumes/${resume.id}`, { headers });
    analyzedResume = await resumeCheck.json();
    if (analyzedResume.atsScore !== null) {
      break;
    }
    await delay(2000);
  }
  
  console.log('Resume Analysis Result:');
  console.log(`- ATS Score: ${analyzedResume.atsScore}`);
  console.log(`- Parsed Skills: ${JSON.stringify(analyzedResume.parsedData?.skills)}`);
  
  if (analyzedResume.atsScore === null) {
    console.error('Resume analysis did not complete in time.');
  }

  // 3. Create Interview
  console.log('Creating Interview...');
  const interviewRes = await fetch(`${BASE_URL}/interviews`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      jobRole: 'Software Engineer',
      type: 'TECHNICAL'
    })
  });
  
  if (!interviewRes.ok) {
    console.error('Interview creation failed', await interviewRes.text());
    return;
  }
  
  const interview = await interviewRes.json();
  console.log(`Interview created: ${interview.id}`);

  // Fetch interview to get questions
  const intGetRes = await fetch(`${BASE_URL}/interviews/${interview.id}`, { headers });
  const interviewData = await intGetRes.json();
  
  console.log(`Generated ${interviewData.questions.length} questions`);
  if (interviewData.questions.length === 0) {
    console.error('No questions generated');
    return;
  }
  console.log(`First Question: ${interviewData.questions[0].questionText}`);

  // 4. Start Interview
  console.log('Starting Interview...');
  await fetch(`${BASE_URL}/interviews/${interview.id}/start`, { method: 'PATCH', headers });
  
  // 5. Submit Answer
  const questionId = interviewData.questions[0].id;
  console.log(`Submitting answer for question ${questionId}...`);
  const answerRes = await fetch(`${BASE_URL}/interviews/questions/${questionId}/answer`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      transcript: 'I have 5 years of experience in JavaScript, React, and Node.js. I have built scalable microservices and integrated with various third-party APIs. I focus on writing clean, maintainable code.',
      durationSeconds: 45
    })
  });
  
  if (!answerRes.ok) {
    console.error('Submit answer failed', await answerRes.text());
    return;
  }
  const answer = await answerRes.json();
  console.log(`Answer submitted: ${answer.id}`);

  // 6. Complete Interview
  console.log('Completing Interview...');
  const completeRes = await fetch(`${BASE_URL}/interviews/${interview.id}/complete`, { method: 'PATCH', headers });
  
  if (!completeRes.ok) {
    console.error('Complete interview failed', await completeRes.text());
    return;
  }

  // Wait for evaluation and report generation
  console.log('Waiting for evaluation and report generation...');
  let finalInterview;
  for (let i = 0; i < 30; i++) {
    const finalCheck = await fetch(`${BASE_URL}/interviews/${interview.id}`, { headers });
    finalInterview = await finalCheck.json();
    if (finalInterview.report !== null && finalInterview.questions[0].answer?.overallScore !== null) {
      break;
    }
    await delay(2000);
  }
  
  const finalAnswer = finalInterview.questions[0].answer;
  console.log('Evaluation Result:');
  console.log(`- Technical Score: ${finalAnswer?.technicalScore}`);
  console.log(`- Communication Score: ${finalAnswer?.communicationScore}`);
  console.log(`- Overall Score: ${finalAnswer?.overallScore}`);
  console.log(`- Feedback: ${JSON.stringify(finalAnswer?.aiFeedback?.summary)}`);

  console.log('Report Result:');
  console.log(`- Final Total Score: ${finalInterview.totalScore}`);
  console.log(`- Report Data: ${JSON.stringify(finalInterview.report?.breakdown)}`);
  
  if (finalAnswer?.overallScore === null) {
    console.error('Evaluation did not complete in time.');
  }
  if (finalInterview.report === null) {
    console.error('Report did not generate in time.');
  }

  console.log('--- E2E TEST COMPLETE ---');
}

runTest().catch(console.error);
