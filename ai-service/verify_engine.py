import asyncio
import os
import json
from dotenv import load_dotenv

# Load env before imports
load_dotenv()

from app.services.groq_service import generate_questions, evaluate_answer, generate_followup

async def verify():
    output = []
    output.append("# Runtime Verification Report: AI Interview Engine\n")

    resume_context = json.dumps({
        "projects": [
            {
                "name": "Distributed Analytics Platform",
                "tech_stack": ["Node.js", "Redis", "BullMQ", "PostgreSQL", "Docker", "Prometheus"]
            }
        ],
        "experienceHighlights": [
            "Scaled WebSocket concurrent connections to 50k",
            "Implemented Redis caching reducing latency by 40%"
        ],
        "technologies": ["Node.js", "Redis", "BullMQ", "PostgreSQL", "WebSockets"]
    })

    print("Generating Questions...")
    output.append("## Phase 1: Question Quality & 5-Stage Flow\n")
    questions = await generate_questions("Backend Engineer", "TECHNICAL", resume_context)
    
    for i, q in enumerate(questions):
        output.append(f"**Q{i+1} ({q['difficulty']}):** {q['text']}")
    
    # Excellent answer
    print("Evaluating Excellent Answer...")
    output.append("\n## Phase 2: Score Calibration (Excellent Answer)\n")
    q1 = questions[0]['text']
    transcript_excellent = "We used Redis mostly as a primary queue store for BullMQ and for caching expensive PostgreSQL analytical queries. For the WebSocket state, we didn't use Redis pub/sub initially but had to migrate to it when we scaled past a single Node.js instance to broadcast messages across the cluster."
    res_excellent = await evaluate_answer(q1, transcript_excellent)
    output.append(f"**Question:** {q1}")
    output.append(f"**Transcript:** {transcript_excellent}")
    output.append(f"**Scores:** Tech: {res_excellent['technicalScore']}, Comm: {res_excellent['communicationScore']}")
    output.append(f"**Feedback:** {res_excellent['feedback']['summary']}\n")

    # Conversational Memory & Follow-up
    print("Generating Follow-up...")
    output.append("## Phase 3: Conversational Memory & Follow-up Generation\n")
    history = [{"question": q1, "answer": transcript_excellent}]
    followup = await generate_followup(q1, transcript_excellent, history)
    output.append(f"**Follow-up Question generated from Q1:**\n{followup}\n")

    # Mid Answer
    print("Evaluating Mid Answer...")
    output.append("## Phase 4: Score Calibration (Mid Answer)\n")
    q2 = questions[1]['text']
    transcript_mid = "The architecture used microservices in Docker. We had a database. We used REST API."
    res_mid = await evaluate_answer(q2, transcript_mid)
    output.append(f"**Question:** {q2}")
    output.append(f"**Transcript:** {transcript_mid}")
    output.append(f"**Scores:** Tech: {res_mid['technicalScore']}, Comm: {res_mid['communicationScore']}")
    output.append(f"**Feedback:** {res_mid['feedback']['summary']}\n")

    # Weak Answer
    print("Evaluating Weak Answer...")
    output.append("## Phase 5: Score Calibration (Weak Answer)\n")
    q3 = questions[2]['text']
    transcript_weak = "Well, honestly I didn't write that part of the code so I'm not really sure how the queue worked."
    res_weak = await evaluate_answer(q3, transcript_weak)
    output.append(f"**Question:** {q3}")
    output.append(f"**Transcript:** {transcript_weak}")
    output.append(f"**Scores:** Tech: {res_weak['technicalScore']}, Comm: {res_weak['communicationScore']}")
    output.append(f"**Feedback:** {res_weak['feedback']['summary']}\n")

    # Filler/Nonsense Answer
    print("Evaluating Filler Answer...")
    output.append("## Phase 6: Score Calibration (Filler/Nonsense)\n")
    q4 = questions[3]['text']
    transcript_filler = "Um yeah basically like, literally I just think that it is what it is, you know?"
    res_filler = await evaluate_answer(q4, transcript_filler)
    output.append(f"**Question:** {q4}")
    output.append(f"**Transcript:** {transcript_filler}")
    output.append(f"**Scores:** Tech: {res_filler['technicalScore']}, Comm: {res_filler['communicationScore']}")
    output.append(f"**Feedback:** {res_filler['feedback']['summary']}\n")

    # Write artifact
    with open("c:/MockMate/ai-service/runtime_verification_report.md", "w", encoding='utf-8') as f:
        f.write("\n".join(output))

if __name__ == "__main__":
    asyncio.run(verify())
