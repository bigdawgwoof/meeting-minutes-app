# Meeting Minutes Generator

Live in-browser speech-to-text meeting recorder that generates structured minutes
and an email summary using the Gemini API.

## How it works

- `src/App.jsx` — the React app (recording UI, transcript review, results)
- `api/generate.js` — a serverless function that holds your Gemini API key
  and calls Gemini on the frontend's behalf. The key is NEVER in frontend code.

## Deploy steps (Vercel + GitHub)

### 1. Push this folder to GitHub
```
cd minutes-app
git init
git add .
git commit -m "Initial commit"
```
Then create a new repo on github.com (no README/license needed, you already
have files), and follow the "push an existing repository" instructions it shows you.

### 2. Import into Vercel
1. Go to https://vercel.com → sign in with GitHub
2. Click "Add New" → "Project"
3. Select your repo → Vercel auto-detects Vite, click "Deploy"
4. It will deploy successfully but the AI calls will fail until step 3

### 3. Add your Gemini API key
1. In your Vercel project → Settings → Environment Variables
2. Add: Name = `GEMINI_API_KEY`, Value = (paste your key from
   https://aistudio.google.com/apikey)
3. Save, then go to Deployments → click the "..." menu on the latest
   deployment → Redeploy (so it picks up the new env var)

### 4. Test it
Visit the URL Vercel gives you (something like
`your-project-name.vercel.app`), open it in Chrome, allow mic access, and
try a short recording.

## Notes

- Live transcription only works in Chrome (and partially Edge) — not
  Firefox or Safari, due to Web Speech API browser support.
- The free Gemini tier has rate limits. Fine for personal/small team use;
  if many people use it heavily you may hit limits and see an error from
  the `/api/generate` call.
- Never commit your actual API key to GitHub. It only ever goes into
  Vercel's environment variable settings, never into a file in this repo.
