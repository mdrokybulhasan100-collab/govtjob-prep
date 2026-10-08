import { createClient } from '@supabase/supabase-js';

const MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

function sendJson(res, status, body) {
  return res.status(status).setHeader('Content-Type', 'application/json').json(body);
}

function cleanJsonText(text) {
  let value = String(text || '').trim();
  value = value.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  const start = value.indexOf('[');
  const end = value.lastIndexOf(']');
  if (start >= 0 && end > start) value = value.slice(start, end + 1);
  return value;
}

function safeError(error) {
  return error instanceof Error ? error.message : String(error || 'Unknown error');
}

export default async function handler(req, res) {
  const startedAt = Date.now();
  let stage = 'start';

  if (req.method !== 'POST') return sendJson(res, 405, { ok: false, stage: 'method', error: 'POST only' });

  try {
    stage = 'environment';
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return sendJson(res, 500, {
        ok: false,
        stage,
        error: 'GEMINI_API_KEY is missing. Vercel → Settings → Environment Variables-এ GEMINI_API_KEY যোগ করুন, তারপর Redeploy করুন।'
      });
    }

    stage = 'authentication';
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
    if (!token) return sendJson(res, 401, { ok: false, stage, error: 'Login required. Admin account দিয়ে আবার login করুন।' });

    const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
    const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
    if (!supabaseUrl || !supabaseAnonKey) {
      return sendJson(res, 500, { ok: false, stage: 'environment', error: 'Supabase server configuration missing. VITE_SUPABASE_URL এবং VITE_SUPABASE_ANON_KEY Vercel Environment Variables-এ আছে কিনা দেখুন।' });
    }

    const sb = createClient(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: `Bearer ${token}` } }
    });

    const { data: { user }, error: userError } = await sb.auth.getUser(token);
    if (userError) {
      return sendJson(res, 401, { ok: false, stage, error: `Supabase auth error: ${userError.message}` });
    }
    if (!user) return sendJson(res, 401, { ok: false, stage, error: 'Session expired. আবার login করুন।' });

    stage = 'admin-check';
    const { data: profile, error: profileError } = await sb
      .from('profiles')
      .select('role,is_admin')
      .eq('id', user.id)
      .maybeSingle();

    if (profileError) {
      return sendJson(res, 500, { ok: false, stage, error: `Admin profile check failed: ${profileError.message}`, user_id: user.id });
    }

    const isAdmin = profile?.role === 'admin' || profile?.is_admin === true;
    if (!isAdmin) {
      return sendJson(res, 403, { ok: false, stage, error: 'শুধু Admin এই feature ব্যবহার করতে পারবেন।', detected_role: profile?.role || null, detected_is_admin: profile?.is_admin ?? null });
    }

    stage = 'request-body';
    let body = req.body || {};
    if (typeof body === 'string') {
      try { body = JSON.parse(body); }
      catch { return sendJson(res, 400, { ok: false, stage, error: 'Request JSON invalid.' }); }
    }

    const image = body.image;
    const language = body.language || 'bn';
    if (!image?.data || !image?.mimeType) return sendJson(res, 400, { ok: false, stage, error: 'একটি image আবশ্যক।' });
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(image.mimeType)) {
      return sendJson(res, 400, { ok: false, stage, error: 'শুধু JPG, PNG অথবা WEBP image ব্যবহার করুন।' });
    }

    // Avoid sending an accidentally huge request to Gemini.
    if (typeof image.data !== 'string' || image.data.length < 100) {
      return sendJson(res, 400, { ok: false, stage, error: 'Image data invalid বা খুব ছোট।' });
    }
    if (image.data.length > 12_000_000) {
      return sendJson(res, 413, { ok: false, stage, error: 'ছবিটি অনেক বড়। JPG/WEBP করে বা compress করে আবার চেষ্টা করুন।' });
    }

    stage = 'gemini-request';
    const prompt = `You are an expert Bengali government-job exam question digitizer. Analyze this photographed book page and extract ONLY clearly visible exam questions.

Return ONLY a valid JSON array. No markdown, no code fences, no commentary.
For every MCQ return exactly this shape:
{"question_type":"mcq","question_text":"...","option_a":"...","option_b":"...","option_c":"...","option_d":"...","correct_option":"a|b|c|d|null","explanation":""}
For a non-MCQ question return:
{"question_type":"short","question_text":"...","short_answer":"...","explanation":""}

Rules:
- Preserve the original wording as closely as possible; do not invent missing text.
- Include all four options for an MCQ when visible.
- Determine correct_option ONLY when explicitly marked, an answer key is visible, or the answer is unambiguous from the supplied page context. Otherwise use null.
- If an answer key is visible elsewhere on the same image, map question numbers to answers.
- Ignore page numbers, headings, explanations, advertisements, and orphaned answer choices.
- Keep question order exactly as on the page.
- If text is too blurry/uncertain, omit that question rather than hallucinating it.
- Output Bengali text when the source is Bengali.
`;

    const payload = {
      contents: [{ parts: [
        { text: prompt },
        { inline_data: { mime_type: image.mimeType, data: image.data } }
      ] }],
      generationConfig: { temperature: 0.1, responseMimeType: 'application/json' }
    };

    const upstream = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(MODEL)}:generateContent?key=${encodeURIComponent(apiKey)}`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }
    );

    stage = 'gemini-response';
    const raw = await upstream.text();
    let data = {};
    try { data = raw ? JSON.parse(raw) : {}; } catch { data = {}; }

    if (!upstream.ok) {
      const msg = data?.error?.message || raw.slice(0, 1000) || `Gemini returned HTTP ${upstream.status}`;
      return sendJson(res, 502, { ok: false, stage, error: `Gemini API error (${upstream.status}): ${msg}`, model: MODEL });
    }

    stage = 'parse-ai-response';
    const text = data?.candidates?.[0]?.content?.parts?.map((p) => p.text || '').join('') || '';
    if (!text) {
      const finish = data?.candidates?.[0]?.finishReason || null;
      return sendJson(res, 502, { ok: false, stage, error: 'Gemini কোনো text response দেয়নি।', finish_reason: finish, model: MODEL });
    }

    let parsed;
    try {
      parsed = JSON.parse(cleanJsonText(text));
    } catch (e) {
      return sendJson(res, 502, { ok: false, stage, error: `Gemini JSON parse failed: ${safeError(e)}`, raw_preview: text.slice(0, 1500) });
    }
    if (!Array.isArray(parsed)) return sendJson(res, 502, { ok: false, stage, error: 'AI response array নয়।', raw_preview: text.slice(0, 1500) });

    const normalized = parsed.map((q) => {
      const type = q.question_type === 'short' ? 'short' : 'mcq';
      const correct = ['a', 'b', 'c', 'd'].includes(String(q.correct_option || '').toLowerCase())
        ? String(q.correct_option).toLowerCase() : null;
      return {
        question_type: type,
        question_text: String(q.question_text || '').trim(),
        option_a: type === 'mcq' ? String(q.option_a || '').trim() : '',
        option_b: type === 'mcq' ? String(q.option_b || '').trim() : '',
        option_c: type === 'mcq' ? String(q.option_c || '').trim() : '',
        option_d: type === 'mcq' ? String(q.option_d || '').trim() : '',
        correct_option: correct,
        short_answer: type === 'short' ? String(q.short_answer || '').trim() : '',
        explanation: String(q.explanation || '').trim()
      };
    }).filter((q) => q.question_text && (q.question_type === 'short'
      ? q.short_answer
      : q.option_a && q.option_b && q.option_c && q.option_d));

    return sendJson(res, 200, {
      ok: true,
      questions: normalized,
      model: MODEL,
      count: normalized.length,
      elapsed_ms: Date.now() - startedAt
    });
  } catch (error) {
    return sendJson(res, 500, {
      ok: false,
      stage,
      error: safeError(error),
      message: 'Server-side extraction failed. উপরের stage দেখে নির্দিষ্ট সমস্যা বোঝা যাবে।'
    });
  }
}
