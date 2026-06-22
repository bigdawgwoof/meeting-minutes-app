import React, { useState, useRef, useEffect, useCallback } from "react";
import { Mic, Square, Pause, Play, FileDown, Mail, Copy, Check, Loader2, AlertCircle, FileText, Users, ListChecks, CalendarClock } from "lucide-react";

const COLORS = {
  ink: "#0A2540",
  paper: "#F7F9FA",
  paperRaised: "#FFFFFF",
  rule: "#DCE3E8",
  accent: "#0072CE",       // Arkema blue
  accentGreen: "#5BC2A8",  // Arkema green (gradient partner)
  accentSoft: "#E6F2FB",
  slate: "#5B6B78",
};

function useSpeechRecognition() {
  const [listening, setListening] = useState(false);
  const [supported, setSupported] = useState(true);
  const [interim, setInterim] = useState("");
  const [finalText, setFinalText] = useState("");
  const recognitionRef = useRef(null);
  const shouldRestartRef = useRef(false);

  useEffect(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      setSupported(false);
      return;
    }
    const rec = new SR();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = "en-US";

    rec.onresult = (event) => {
      let interimPiece = "";
      let finalPiece = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const t = event.results[i][0].transcript;
        if (event.results[i].isFinal) finalPiece += t + " ";
        else interimPiece += t;
      }
      if (finalPiece) setFinalText((prev) => prev + finalPiece);
      setInterim(interimPiece);
    };

    rec.onerror = (e) => {
      if (e.error === "not-allowed" || e.error === "service-not-allowed") setSupported(false);
    };

    rec.onend = () => {
      if (shouldRestartRef.current) {
        try { rec.start(); } catch (err) {}
      } else {
        setListening(false);
      }
    };

    recognitionRef.current = rec;
    return () => {
      shouldRestartRef.current = false;
      try { rec.stop(); } catch (err) {}
    };
  }, []);

  const start = useCallback(() => {
    if (!recognitionRef.current) return;
    shouldRestartRef.current = true;
    try {
      recognitionRef.current.start();
      setListening(true);
    } catch (err) {}
  }, []);

  const pause = useCallback(() => {
    shouldRestartRef.current = false;
    try { recognitionRef.current && recognitionRef.current.stop(); } catch (err) {}
    setListening(false);
  }, []);

  const reset = useCallback(() => {
    setFinalText("");
    setInterim("");
  }, []);

  return { listening, supported, interim, finalText, start, pause, reset };
}

function fmtClock(ms) {
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60).toString().padStart(2, "0");
  const s = (totalSec % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

// Calls OUR OWN serverless function, never Gemini directly.
// The real API key lives only on the server (Vercel env var), never in this code.
async function generateMinutes(prompt) {
  const response = await fetch("/api/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt }),
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || `Request failed: ${response.status}`);
  }
  return data.text || "";
}

function buildPrompt({ transcript, meetingTitle, attendeesRaw, meetingDate }) {
  return `You are an assistant that turns raw, messy, live speech-to-text meeting transcripts into clean professional meeting minutes for a corporate workplace. The transcript was captured live during an in-person meeting via browser speech recognition, so expect filler words, run-ons, and no speaker labels. Infer structure, topics, decisions and action items from context.

Meeting title: ${meetingTitle || "(not provided, infer one)"}
Meeting date: ${meetingDate || "(not provided)"}
Attendees (as typed by user): ${attendeesRaw || "(not provided)"}

RAW TRANSCRIPT:
"""
${transcript}
"""

Return ONLY valid JSON, no markdown fences, no preamble, matching exactly this schema:
{
  "title": "string",
  "date": "string",
  "attendees": ["array of strings"],
  "summary": "2-4 sentence overview",
  "topics": [{"heading": "string", "notes": "string"}],
  "decisions": ["array of strings"],
  "actionItems": [{"task": "string", "owner": "string or Unassigned", "due": "string or Not specified"}],
  "emailSummary": "plain text email body using \\n for line breaks, professional and concise, sign off with 'Thanks all,' with no name"
}

Use empty arrays/strings rather than inventing content if unclear. Be concise and professional.`;
}

function downloadDocx(minutes) {
  const esc = (s) => (s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const topicsHtml = (minutes.topics || [])
    .map((t) => `<h3 style="font-family:Calibri,Arial,sans-serif;font-size:13pt;margin:14pt 0 4pt 0;">${esc(t.heading)}</h3><p style="font-family:Calibri,Arial,sans-serif;font-size:11pt;margin:0 0 8pt 0;">${esc(t.notes)}</p>`)
    .join("\n");
  const decisionsHtml = (minutes.decisions || []).length
    ? `<ul>${(minutes.decisions || []).map((d) => `<li style="font-family:Calibri,Arial,sans-serif;font-size:11pt;margin-bottom:4pt;">${esc(d)}</li>`).join("")}</ul>`
    : `<p style="font-family:Calibri,Arial,sans-serif;font-size:11pt;color:#666;">No formal decisions recorded.</p>`;
  const actionsHtml = (minutes.actionItems || []).length
    ? `<table style="width:100%;border-collapse:collapse;margin-top:6pt;" cellpadding="6">
        <tr style="background:#F1E3DC;">
          <th style="font-family:Calibri,Arial,sans-serif;font-size:10.5pt;text-align:left;border:1px solid #D9D2C4;padding:6pt;">Action Item</th>
          <th style="font-family:Calibri,Arial,sans-serif;font-size:10.5pt;text-align:left;border:1px solid #D9D2C4;padding:6pt;">Owner</th>
          <th style="font-family:Calibri,Arial,sans-serif;font-size:10.5pt;text-align:left;border:1px solid #D9D2C4;padding:6pt;">Due</th>
        </tr>
        ${(minutes.actionItems || [])
          .map(
            (a) =>
              `<tr><td style="font-family:Calibri,Arial,sans-serif;font-size:10.5pt;border:1px solid #D9D2C4;padding:6pt;">${esc(a.task)}</td><td style="font-family:Calibri,Arial,sans-serif;font-size:10.5pt;border:1px solid #D9D2C4;padding:6pt;">${esc(a.owner)}</td><td style="font-family:Calibri,Arial,sans-serif;font-size:10.5pt;border:1px solid #D9D2C4;padding:6pt;">${esc(a.due)}</td></tr>`
          )
          .join("\n")}
      </table>`
    : `<p style="font-family:Calibri,Arial,sans-serif;font-size:11pt;color:#666;">No action items recorded.</p>`;

  const html = `
  <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
  <head><meta charset="utf-8"><title>${esc(minutes.title)}</title></head>
  <body style="margin:0.75in;">
    <h1 style="font-family:Calibri,Arial,sans-serif;font-size:20pt;color:#1C2B33;border-bottom:2pt solid #8A3324;padding-bottom:8pt;margin-bottom:4pt;">${esc(minutes.title || "Meeting Minutes")}</h1>
    <p style="font-family:Calibri,Arial,sans-serif;font-size:10.5pt;color:#666;margin-top:0;">${esc(minutes.date || "")}</p>
    <p style="font-family:Calibri,Arial,sans-serif;font-size:10.5pt;"><b>Attendees:</b> ${esc((minutes.attendees || []).join(", ") || "Not recorded")}</p>
    <h2 style="font-family:Calibri,Arial,sans-serif;font-size:14pt;margin-top:20pt;">Summary</h2>
    <p style="font-family:Calibri,Arial,sans-serif;font-size:11pt;">${esc(minutes.summary)}</p>
    <h2 style="font-family:Calibri,Arial,sans-serif;font-size:14pt;margin-top:20pt;">Discussion</h2>
    ${topicsHtml}
    <h2 style="font-family:Calibri,Arial,sans-serif;font-size:14pt;margin-top:20pt;">Decisions</h2>
    ${decisionsHtml}
    <h2 style="font-family:Calibri,Arial,sans-serif;font-size:14pt;margin-top:20pt;">Action Items</h2>
    ${actionsHtml}
  </body>
  </html>`;

  const blob = new Blob(["\ufeff", html], { type: "application/msword" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${(minutes.title || "Meeting_Minutes").replace(/[^a-z0-9]+/gi, "_")}.doc`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export default function App() {
  const [stage, setStage] = useState("setup");
  const [meetingTitle, setMeetingTitle] = useState("");
  const [attendeesRaw, setAttendeesRaw] = useState("");
  const [meetingDate, setMeetingDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [manualText, setManualText] = useState("");
  const [elapsed, setElapsed] = useState(0);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");
  const [minutes, setMinutes] = useState(null);
  const [copied, setCopied] = useState(false);
  const timerRef = useRef(null);
  const recordStartRef = useRef(null);
  const sr = useSpeechRecognition();
  const transcriptBoxRef = useRef(null);

  useEffect(() => {
    if (sr.listening) {
      if (!recordStartRef.current) recordStartRef.current = Date.now() - elapsed;
      timerRef.current = setInterval(() => setElapsed(Date.now() - recordStartRef.current), 500);
    } else {
      clearInterval(timerRef.current);
    }
    return () => clearInterval(timerRef.current);
  }, [sr.listening]);

  useEffect(() => {
    if (transcriptBoxRef.current) {
      transcriptBoxRef.current.scrollTop = transcriptBoxRef.current.scrollHeight;
    }
  }, [sr.finalText, sr.interim]);

  const handleStart = () => {
    setStage("recording");
    sr.start();
  };

  const handleFinish = () => {
    sr.pause();
    setManualText(sr.finalText);
    setStage("review");
  };

  const handleGenerate = async () => {
    const transcript = (manualText || sr.finalText || "").trim();
    if (!transcript) {
      setError("There's no transcript text to work with yet.");
      return;
    }
    setError("");
    setGenerating(true);
    try {
      const raw = await generateMinutes(buildPrompt({ transcript, meetingTitle, attendeesRaw, meetingDate }));
      const cleaned = raw.replace(/^```json\s*/i, "").replace(/```\s*$/i, "").trim();
      const parsed = JSON.parse(cleaned);
      setMinutes(parsed);
      setStage("results");
    } catch (e) {
      setError(`Something went wrong generating the minutes: ${e.message}`);
    } finally {
      setGenerating(false);
    }
  };

  const handleCopyEmail = () => {
    if (!minutes) return;
    navigator.clipboard.writeText(minutes.emailSummary || "");
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleStartOver = () => {
    sr.reset();
    setManualText("");
    setMinutes(null);
    setElapsed(0);
    recordStartRef.current = null;
    setError("");
    setStage("setup");
  };

  return (
    <div style={{ fontFamily: "'Source Sans 3','Segoe UI',Arial,sans-serif", background: COLORS.paper, color: COLORS.ink, minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center" }}>
      <div style={{ width: "100%", maxWidth: 760, padding: "28px 20px 60px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4, paddingBottom: 18, borderBottom: `3px solid transparent`, backgroundImage: `linear-gradient(${COLORS.paper}, ${COLORS.paper}), linear-gradient(90deg, ${COLORS.accent}, ${COLORS.accentGreen})`, backgroundOrigin: "border-box", backgroundClip: "content-box, border-box" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            {/* Logo placeholder — replace the box below with <img src="/arkema-logo.png" style={{height: 36}} /> once you have the file */}
            <img src="/arkema-logo.png" style={{ height: 36 }} />
            <div>
              <div style={{ fontSize: 11, letterSpacing: "0.12em", color: COLORS.slate, fontWeight: 600, textTransform: "uppercase" }}>Arkema</div>
              <div style={{ fontSize: 23, fontWeight: 700, color: COLORS.ink, marginTop: 1 }}>Meeting Minutes Transcriber</div>
            </div>
          </div>
        </div>

        {stage === "setup" && (
          <div style={{ marginTop: 28 }}>
            {!sr.supported && (
              <div style={{ display: "flex", gap: 10, background: "#FBEAEA", border: "1px solid #E2B4B4", borderRadius: 6, padding: "12px 14px", marginBottom: 20, fontSize: 13.5, color: "#7A2424" }}>
                <AlertCircle size={18} style={{ flexShrink: 0, marginTop: 1 }} />
                <div>Live transcription isn't available in this browser, or mic access was denied. Works best in Chrome on desktop. You can paste in notes manually below instead.</div>
              </div>
            )}
            <div style={{ display: "grid", gap: 14, marginBottom: 24 }}>
              <Field label="Meeting title (optional)">
                <input value={meetingTitle} onChange={(e) => setMeetingTitle(e.target.value)} placeholder="e.g. Weekly S&OP Sync" style={inputStyle} />
              </Field>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                <Field label="Date">
                  <input type="date" value={meetingDate} onChange={(e) => setMeetingDate(e.target.value)} style={inputStyle} />
                </Field>
                <Field label="Attendees (optional)">
                  <input value={attendeesRaw} onChange={(e) => setAttendeesRaw(e.target.value)} placeholder="e.g. Raj, Mei, Pierre" style={inputStyle} />
                </Field>
              </div>
            </div>
            <button onClick={handleStart} disabled={!sr.supported} style={primaryButtonStyle(!sr.supported)}>
              <Mic size={18} /> Start recording
            </button>
            <div style={{ textAlign: "center", margin: "18px 0", color: COLORS.slate, fontSize: 12.5 }}>— or —</div>
            <Field label="Paste notes or an existing transcript instead">
              <textarea value={manualText} onChange={(e) => setManualText(e.target.value)} placeholder="Paste rough notes or a transcript here..." rows={6} style={{ ...inputStyle, resize: "vertical", fontFamily: "inherit" }} />
            </Field>
            {manualText.trim() && (
              <button onClick={() => setStage("review")} style={secondaryButtonStyle}>Continue with pasted text</button>
            )}
          </div>
        )}

        {stage === "recording" && (
          <div style={{ marginTop: 24 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 14, marginBottom: 18 }}>
              <div style={{ width: 14, height: 14, borderRadius: "50%", background: sr.listening ? COLORS.accent : COLORS.rule, animation: sr.listening ? "pulse 1.4s infinite" : "none" }} />
              <div style={{ fontSize: 28, fontWeight: 700, fontFamily: "monospace" }}>{fmtClock(elapsed)}</div>
            </div>
            <div style={{ textAlign: "center", color: COLORS.slate, fontSize: 13, marginBottom: 20 }}>{sr.listening ? "Listening — keep this tab open and active" : "Paused"}</div>
            <div ref={transcriptBoxRef} style={{ background: COLORS.paperRaised, border: `1px solid ${COLORS.rule}`, borderRadius: 8, padding: 18, minHeight: 220, maxHeight: 340, overflowY: "auto", fontSize: 14.5, lineHeight: 1.6, marginBottom: 20 }}>
              {sr.finalText || sr.interim ? (
                <>
                  <span>{sr.finalText}</span>
                  <span style={{ color: COLORS.slate }}> {sr.interim}</span>
                </>
              ) : (
                <span style={{ color: COLORS.slate, fontStyle: "italic" }}>Transcript will appear here as people speak…</span>
              )}
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              {sr.listening ? (
                <button onClick={sr.pause} style={secondaryButtonStyle}><Pause size={16} /> Pause</button>
              ) : (
                <button onClick={sr.start} style={secondaryButtonStyle}><Play size={16} /> Resume</button>
              )}
              <button onClick={handleFinish} style={primaryButtonStyle(false)}><Square size={16} /> Finish meeting</button>
            </div>
          </div>
        )}

        {stage === "review" && (
          <div style={{ marginTop: 24 }}>
            <div style={{ fontSize: 13, color: COLORS.slate, marginBottom: 10 }}>Review or clean up the transcript before generating minutes.</div>
            <textarea value={manualText} onChange={(e) => setManualText(e.target.value)} rows={14} style={{ ...inputStyle, resize: "vertical", fontFamily: "inherit", fontSize: 14, lineHeight: 1.6 }} />
            {error && <div style={{ color: COLORS.accent, fontSize: 13, marginTop: 10 }}>{error}</div>}
            <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
              <button onClick={() => setStage("setup")} style={secondaryButtonStyle}>Back</button>
              <button onClick={handleGenerate} disabled={generating} style={primaryButtonStyle(generating)}>
                {generating ? (<><Loader2 size={16} className="spin" /> Generating minutes…</>) : (<><FileText size={16} /> Generate minutes</>)}
              </button>
            </div>
          </div>
        )}

        {stage === "results" && minutes && (
          <div style={{ marginTop: 20 }}>
            <div style={{ background: COLORS.paperRaised, border: `1px solid ${COLORS.rule}`, borderRadius: 10, padding: 24, marginBottom: 20 }}>
              <h2 style={{ fontSize: 20, fontWeight: 700, margin: "0 0 4px 0" }}>{minutes.title}</h2>
              <div style={{ fontSize: 12.5, color: COLORS.slate, marginBottom: 14 }}>{minutes.date}</div>
              {minutes.attendees && minutes.attendees.length > 0 && (
                <SectionRow icon={<Users size={15} />} label="Attendees">{minutes.attendees.join(", ")}</SectionRow>
              )}
              <SectionBlock title="Summary"><p style={{ margin: 0, fontSize: 14, lineHeight: 1.6 }}>{minutes.summary}</p></SectionBlock>
              {minutes.topics && minutes.topics.length > 0 && (
                <SectionBlock title="Discussion">
                  {minutes.topics.map((t, i) => (
                    <div key={i} style={{ marginBottom: 10 }}>
                      <div style={{ fontWeight: 600, fontSize: 13.5 }}>{t.heading}</div>
                      <div style={{ fontSize: 13.5, lineHeight: 1.5 }}>{t.notes}</div>
                    </div>
                  ))}
                </SectionBlock>
              )}
              {minutes.decisions && minutes.decisions.length > 0 && (
                <SectionBlock title="Decisions">
                  <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13.5, lineHeight: 1.6 }}>
                    {minutes.decisions.map((d, i) => <li key={i}>{d}</li>)}
                  </ul>
                </SectionBlock>
              )}
              {minutes.actionItems && minutes.actionItems.length > 0 && (
                <SectionBlock title="Action items" icon={<ListChecks size={15} />}>
                  <div style={{ display: "grid", gap: 8 }}>
                    {minutes.actionItems.map((a, i) => (
                      <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr auto auto", gap: 10, alignItems: "center", background: COLORS.accentSoft, borderRadius: 6, padding: "8px 12px", fontSize: 13 }}>
                        <div>{a.task}</div>
                        <div style={{ color: COLORS.accent, fontWeight: 600, whiteSpace: "nowrap" }}>{a.owner}</div>
                        <div style={{ color: COLORS.slate, display: "flex", alignItems: "center", gap: 4, whiteSpace: "nowrap" }}><CalendarClock size={13} /> {a.due}</div>
                      </div>
                    ))}
                  </div>
                </SectionBlock>
              )}
            </div>

            <div style={{ background: COLORS.paperRaised, border: `1px solid ${COLORS.rule}`, borderRadius: 10, padding: 24, marginBottom: 24 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 700, fontSize: 14, marginBottom: 12 }}>
                <Mail size={16} color={COLORS.accent} /> Email summary, ready to send
              </div>
              <div style={{ background: COLORS.paper, border: `1px solid ${COLORS.rule}`, borderRadius: 6, padding: 14, fontSize: 13.5, lineHeight: 1.6, whiteSpace: "pre-wrap", marginBottom: 12 }}>
                {minutes.emailSummary}
              </div>
              <button onClick={handleCopyEmail} style={secondaryButtonStyle}>
                {copied ? <Check size={16} /> : <Copy size={16} />} {copied ? "Copied" : "Copy email text"}
              </button>
            </div>

            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => downloadDocx(minutes)} style={primaryButtonStyle(false)}><FileDown size={16} /> Download as Word doc</button>
              <button onClick={handleStartOver} style={secondaryButtonStyle}>Start a new meeting</button>
            </div>
          </div>
        )}
      </div>

      <div style={{ width: "100%", maxWidth: 760, padding: "0 20px 24px", display: "flex", justifyContent: "flex-end" }}>
        <div style={{ fontSize: 11.5, color: COLORS.slate, fontStyle: "italic" }}>Made by Roshan</div>
      </div>

      <style>{`
        @keyframes pulse { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.5; transform: scale(0.85); } }
        .spin { animation: spin 1s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        input:focus, textarea:focus { outline: none; border-color: ${COLORS.accent} !important; }
      `}</style>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label style={{ display: "block" }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: COLORS.slate, marginBottom: 5 }}>{label}</div>
      {children}
    </label>
  );
}

function SectionRow({ icon, label, children }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: COLORS.slate, marginBottom: 12 }}>
      {icon}<b style={{ color: COLORS.ink }}>{label}:</b> {children}
    </div>
  );
}

function SectionBlock({ title, icon, children }) {
  return (
    <div style={{ marginTop: 18, paddingTop: 16, borderTop: `1px solid ${COLORS.rule}` }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 700, color: COLORS.slate, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>
        {icon} {title}
      </div>
      {children}
    </div>
  );
}

const inputStyle = { width: "100%", padding: "10px 12px", fontSize: 14, border: `1px solid ${COLORS.rule}`, borderRadius: 6, background: COLORS.paperRaised, color: COLORS.ink, boxSizing: "border-box" };

function primaryButtonStyle(disabled) {
  return { display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, width: "100%", padding: "12px 18px", fontSize: 14.5, fontWeight: 600, color: "#fff", background: disabled ? COLORS.slate : COLORS.accent, border: "none", borderRadius: 7, cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.7 : 1 };
}

const secondaryButtonStyle = { display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, flex: 1, padding: "12px 18px", fontSize: 14.5, fontWeight: 600, color: COLORS.ink, background: COLORS.paperRaised, border: `1px solid ${COLORS.rule}`, borderRadius: 7, cursor: "pointer" };
