# Final Practical Project Submission Guide

Due: **May 3, 2026, 11:59 PM**  
Project type: **Individual**  
Submission requirement: **Live public URL**

---

## 1) Requirement Audit (Current Status)

### Tier 1 - Infrastructure (50 pts)

- [ ] Live hosting on VPS/shared host with public URL  
  Status: **Not verifiable from repo** (must be confirmed on live server)
- [ ] Custom domain with DNS pointing to server  
  Status: **Not verifiable from repo**
- [ ] SSL/TLS via Let's Encrypt (green padlock)  
  Status: **Not verifiable from repo**
- [ ] 301 redirect HTTP -> HTTPS  
  Status: **Not verifiable from repo**
- [ ] Firewall (UFW/equivalent) only ports 22, 80, 443  
  Status: **Not verifiable from repo**
- [ ] Nginx/Apache server blocks configured properly  
  Status: **Not verifiable from repo**

**Conclusion for Tier 1:** must be completed and evidenced on deployment host.

---

### Tier 2 - AI Integration (70 pts)

- [x] Server-side API call in Node with key outside browser  
  Evidence: `backend/src/utils/geminiJson.js`, `backend/.env.example`
- [x] Contextual AI feature (not generic chatbot)  
  Evidence: interview question generation + per-question coaching + session summary in `backend/src/services/practiceInterview.service.js`
- [x] Custom system prompt written/tuned  
  Evidence: prompts in `generatePracticeQuestions`, `practiceAnswerFeedback`, `practiceSessionSummary`
- [x] Graceful error handling  
  Evidence: `backend/src/controllers/practice.controller.js`, fallback handling in `backend/src/utils/geminiJson.js`
- [x] Live + functional at grading time  
  Status: **You must verify on deployed URL**
- [x] Endpoint routed through web server (backend route; not direct browser key usage)  
  Evidence: `backend/src/routes/practice.routes.js`, mounted in `backend/src/routes/index.js`, frontend uses backend API (`frontend/lib/api.js`)

---

### Tier 3 - Professional Polish (30 pts)

#### Documentation (15 pts)
- [x] Tech stack manifest -> included below
- [x] Written explanation of AI feature -> included below
- [ ] Live screenshot -> **you add**

#### LinkedIn Portfolio Artifact (15 pts)
- [ ] LinkedIn post/project entry with screenshot
- [ ] Hard skill tags
- [ ] Link to live URL

---

## 2) What Was Implemented in This Project

## Core Product

The app provides **adaptive mock interview practice** with:
- Interview modes: Technical, Behavioral, System Design
- 5 generated questions based on years of experience and optional resume context
- Per-question AI feedback
- Final session analysis (score, readiness, role fit, strengths/improvements/focus)
- Practice history with pass/fail and failure reasons

## AI Flow (Server-Side)

1. `POST /v1/practice/generate-questions`  
   Generates 5 tailored questions via Gemini.
2. `POST /v1/practice/feedback`  
   Returns per-question coaching with `substanceScoreOutOf100`, strengths, gaps, follow-up prompts.
3. `POST /v1/practice/session-summary`  
   Ensures any missing per-question feedback is generated, then computes final summary/readiness/role-fit.

Security and architecture:
- API key stays server-side in env (`GEMINI_API_KEY`)
- Auth-protected endpoints (`requireAuth()`)
- Backend route layer mediates AI requests (no direct browser-to-Gemini key exposure)

## Production UX Enhancements Added

- Ongoing session leave-warning before navigation/refresh
- New-set discard confirmation modal
- Strict answer validation (no empty/space-only answers)
- Clear loading state while final result is generated
- Pass/Fail status with explicit failure reasons
- History page includes status badges and failure reason tooltip

---

## 3) Tech Stack Manifest

## Frontend
- Next.js 16.2.4
- React 19.2.4
- Tailwind CSS 4
- lucide-react (icons)

## Backend
- Node.js + Express 4
- MongoDB + Mongoose 9
- JWT auth
- Winston logging
- Gemini API integration (server-side fetch)

## Infra (target deployment)
- Linux VPS/shared host
- Nginx or Apache reverse proxy
- Let's Encrypt certificate
- UFW firewall

---

## 4) Infrastructure Completion Checklist (Do This Before Submission)

Use this as your final go-live checklist.

1. Deploy frontend + backend to VPS/shared host
2. Attach domain DNS (`A`/`AAAA`) to server IP
3. Configure Nginx/Apache virtual host/server block
4. Issue cert with Let's Encrypt (`certbot`)
5. Force 301 HTTP -> HTTPS
6. Restrict firewall ports to `22`, `80`, `443`
7. Verify live behavior:
   - Login works
   - Generate questions works
   - Per-question feedback works
   - Final summary works
   - History page updates after completion

---

## 5) Screenshot Placeholders (Add Your Live Images)

Keep these sections and replace the comments with actual screenshots in your final submission copy.

### Screenshot A - Live site with HTTPS and domain
<!-- ADD SCREENSHOT: Browser URL bar showing your custom domain + lock icon + app home/dashboard -->

### Screenshot B - AI feature live in action
<!-- ADD SCREENSHOT: Question shown, candidate answer entered, AI per-question feedback visible -->

### Screenshot C - Final session result
<!-- ADD SCREENSHOT: Overall result section with score, readiness, pass/fail, and failure reason/pass badge -->

### Screenshot D - History page
<!-- ADD SCREENSHOT: Practice history list showing score + pass/fail status (and failed tooltip if possible) -->

### Screenshot E - Server security proof
<!-- ADD SCREENSHOT: Terminal output of 'sudo ufw status numbered' showing only 22/80/443 allowed -->

### Screenshot F - HTTPS redirect proof
<!-- ADD SCREENSHOT: Terminal output of 'curl -I http://yourdomain.com' showing 301 to https -->

### Screenshot G - SSL certificate proof
<!-- ADD SCREENSHOT: Terminal output of certbot certificate info or browser cert details -->

---

## 6) LinkedIn Portfolio Artifact Template

Use this draft and adjust tone:

> Built and deployed an AI-powered adaptive mock interview platform as a full-stack individual final project.  
> Implemented secure server-side AI integration (Node/Express + Gemini), contextual prompting, per-question coaching, session-level readiness scoring, and production deployment with HTTPS + domain.  
> Live demo: [YOUR_LIVE_URL]

Suggested hard skill tags:
- Linux
- Nginx
- SSL
- WebOps
- AI
- API Integration
- Prompt Engineering
- Next.js
- Node.js
- MongoDB

Add:
- One live screenshot
- Link to your deployed URL
- "Project" or "Post" entry on LinkedIn

---

## 7) Final "Missing Requirements" Summary

Based on repository audit:

- **Already implemented in code:** Tier 2 AI integration requirements + most Tier 3 writing requirements.
- **Still required from deployment side:** Tier 1 infra requirements (domain, SSL, redirect, firewall, server block) and live proof screenshots.
- **Still required for portfolio:** LinkedIn artifact.

If you want, I can generate a second file next: a copy-paste **submission PDF/Doc format** version with tighter wording for your professor.
