# InterviewBrain — Course project submission

**Student project · Hands-on practical submission**

| Item | Link / detail |
|------|----------------|
| **Live application** | https://www.interviewbrain.xyz |
| **API (JSON)** | https://api.interviewbrain.xyz |
| **Health check** | https://api.interviewbrain.xyz/v1/health |

---

## What I built

**InterviewBrain** is a full-stack web application for **text-only mock interview practice**. Candidates choose an interview focus (technical, behavioral, or system design), receive **AI-generated questions** (Google Gemini, **server-side only**), submit written answers, and get **structured feedback** plus an **end-of-session summary**. Staff can use an **admin** area to manage users and **impersonate a candidate** (switch into their session from the admin table) to verify the product **end-to-end**.

The repository contains **two deployable parts**: a **Next.js** frontend (`frontend/`) and a **Node.js / Express** backend (`backend/`), deployed to **Vercel** with **custom domains** and **HTTPS**.

---

## Technologies and tools

| Category | Technology |
|----------|------------|
| **Frontend** | Next.js (React), JavaScript, Tailwind-style UI |
| **Backend** | Node.js, Express, REST API under `/v1` |
| **Database** | MongoDB with Mongoose; **MongoDB Atlas** in production |
| **Authentication** | JWT (`JWT_SECRET` on server) |
| **AI** | Google Gemini API (**API key only on server**, never in browser) |
| **Hosting / TLS** | **Vercel** (two projects from one repo), custom DNS, managed HTTPS |
| **Version control** | Git / GitHub |

---

## Repository layout (labeled)

| Path | Component |
|------|-----------|
| `frontend/` | Next.js app: login, candidate dashboard, practice flow, admin UI, middleware (`proxy.js`), API rewrites (`next.config.mjs`). |
| `backend/` | Express app: auth, practice routes, Gemini integration, MongoDB models; Vercel entry `api/index.js`. |
| `docs/` | Extra documentation and assets (see below). |
| `docs/architecture.svg` | System architecture diagram (vector). |
| `docs/InterviewBrain_Submission.html` | Printable write-up (14px bold section titles, 12px body) — open in Chrome → **Print → Save as PDF**. |
| `docs/VERCEL_DEPLOY_PLAYBOOK.md` | Vercel deploy steps and environment variables. |

---

## Architecture (summary)

**Concept:** The browser talks to **`https://www…`** for pages. API calls use **same-origin** paths like **`/v1/auth/login`** and **`/v1/practice/…`** so the session stays on one trusted site name; **Next.js rewrites** forward `/v1/*` to **`https://api.interviewbrain.xyz`**. The backend never exposes **`GEMINI_API_KEY`** or **`MONGODB_URI`** to the client.

**Diagram:** Open **`docs/architecture.svg`** (any browser or insert into Word/Google Docs).

---

## Challenges encountered (real-world)

1. **Production vs local API URL** — Configured **`NEXT_PUBLIC_API_URL`** empty in production so calls stay same-origin; set **`API_REWRITE_TARGET`** for the API host on Vercel.  
2. **CORS and www vs apex** — Registered **both** origins in backend CORS env and used a **canonical `www`** URL to avoid split sessions.  
3. **MongoDB Atlas network access** — Vercel uses **dynamic egress IPs**; allowed **`0.0.0.0/0`** in Atlas IP Access so serverless functions can connect (credentials still required).  
4. **Login POST returning 405** — Edge middleware was redirecting **`/v1/*`** to `/login`; fixed by **excluding `/v1/*`** from page redirects so JSON API requests are not turned into HTML navigation.  
5. **Gemini quotas / model availability** — Implemented **fallback models** and clear **502** error messages when quota or model errors occur.

---

## Course requirements alignment (instructor rubric)

| Theme | How this project satisfies it |
|--------|--------------------------------|
| Public hosted URL with real DNS | Custom domains on Vercel; **`www`** canonical; separate **`api`** subdomain. |
| TLS / padlock | Managed certificates on Vercel (HTTPS). |
| HTTP → HTTPS | Automatic redirect at the edge. |
| Server-side AI; key not in browser | Gemini called only from Express; **`GEMINI_API_KEY`** in Vercel **backend** env only. |
| Contextual AI feature | Interview-specific question generation, per-answer coaching, session summary — not a generic chatbot. |
| Custom prompts | Authored in backend services (`practiceInterview.service.js`). |
| Graceful errors | JSON **`{ error: "…" }`**; UI shows message; Gemini helper handles quota / fallbacks. |
| Routing / “web server” analogy | Hostname routing on Vercel + **Next.js rewrites** for `/v1` (similar intent to Nginx `proxy_pass`). |

---

## Screenshot checklist (for your PDF or write-up)

| # | What to capture |
|---|-----------------|
| 1 | Login page — **Candidate** tab, URL bar + padlock. |
| 2 | Login page — **Administrator** tab. |
| 3 | Candidate **dashboard** (type, experience, start practice). |
| 4 | One **question** with answer + **per-question AI feedback**. |
| 5 | **End of session** (summary / scores / pass-fail as shown). |
| 6 | **Practice history** (list or one session). |
| 7 | **Admin — Candidates** table (row with **switch into candidate** + edit icons). |
| 8 | **Impersonation** — candidate view with **switch back to admin** (if your UI shows it). |
| 9 *(optional)* | DevTools **Network** — successful `POST` to `/v1/...` on same host as the page. |

## Documentation files to submit

Include in your zip **at minimum**:

1. This **`README.md`**.  
2. **`docs/architecture.svg`**.  
3. **`docs/InterviewBrain_Submission.html`** (optional: print to PDF in Chrome).  
4. The **screenshots** from the table above.  
5. Optional: **`docs/VERCEL_DEPLOY_PLAYBOOK.md`** for deployment detail.

---

## Local development (optional)

- **Backend:** From `backend/`, install dependencies, set `.env` (`MONGODB_URI`, `JWT_SECRET`, `GEMINI_API_KEY`), run the start script defined in `backend/package.json` (typically port **3001**).  
- **Frontend:** From `frontend/`, install dependencies, run `npm run dev`; point at local API or use env as documented in `VERCEL_DEPLOY_PLAYBOOK.md`.

---

## Acknowledgments

Built as the **final hands-on practical project** — demonstrating deployment, REST API design, authentication, third-party AI integration, and production troubleshooting aligned with skills from the semester.
