import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useApp } from "../lib/AppContext";
import { shuffle, toBn } from "../lib/utils";

const KEYS = ["a", "b", "c", "d"];
const LETTERS = ["এ", "বি", "সি", "ডি"];
const isShort = q => String(q.question_type || "").toLowerCase() === "short";
const getOptions = q => KEYS.filter(k => String(q[`option_${k}`] ?? "").trim()).map(key => ({ key, text: q[`option_${key}`] }));

export default function AudioPractice() {
  const { subjects, topics } = useApp();
  const [type, setType] = useState("all"), [subjectId, setSubjectId] = useState(""), [topicId, setTopicId] = useState("");
  const [count, setCount] = useState("20"), [delay, setDelay] = useState("10"), [rate, setRate] = useState("1"), [optionPause, setOptionPause] = useState(true);
  const [questions, setQuestions] = useState([]), [index, setIndex] = useState(0), [status, setStatus] = useState("idle"), [message, setMessage] = useState("সেটিংস নির্বাচন করে অডিও প্র্যাকটিস শুরু করুন।");
  const [loading, setLoading] = useState(false), [error, setError] = useState("");
  const runRef = useRef(0), timerRef = useRef(null), utteranceRef = useRef(null), pausedRef = useRef(false), indexRef = useRef(0), questionsRef = useRef([]), stageRef = useRef("question");
  const settingsRef = useRef({ delay: 10, optionPause: true, rate: 1 });
  const topicChoices = useMemo(() => topics.filter(t => !subjectId || t.subject_id === subjectId), [topics, subjectId]);

  const stopEngine = useCallback(() => {
    runRef.current += 1;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    utteranceRef.current = null; pausedRef.current = false;
  }, []);
  useEffect(() => () => stopEngine(), [stopEngine]);

  const speak = useCallback((text, done, run) => {
    if (!("speechSynthesis" in window) || !("SpeechSynthesisUtterance" in window)) {
      setError("এই ব্রাউজারে Text-to-Speech সমর্থিত নয়। আপডেটেড Chrome বা Safari ব্যবহার করুন।"); setStatus("idle"); return;
    }
    const u = new SpeechSynthesisUtterance(String(text || ""));
    u.lang = /[অ-৿]/.test(String(text)) ? "bn-BD" : "en-US";
    u.rate = settingsRef.current.rate;
    const voices = window.speechSynthesis.getVoices();
    const voice = voices.find(v => v.lang?.toLowerCase() === u.lang.toLowerCase()) || voices.find(v => v.lang?.toLowerCase().startsWith(u.lang.split("-")[0]));
    if (voice) u.voice = voice;
    utteranceRef.current = u;
    u.onend = () => { if (run === runRef.current && !pausedRef.current) done(); };
    u.onerror = e => { if (run === runRef.current && !["canceled", "interrupted"].includes(e.error)) { setError("অডিও চালাতে সমস্যা হয়েছে। আবার শুরু করে দেখুন।"); setStatus("idle"); } };
    window.speechSynthesis.cancel(); window.speechSynthesis.speak(u);
  }, []);

  const go = useCallback((nextStage, run = runRef.current) => {
    if (run !== runRef.current || pausedRef.current) return;
    stageRef.current = nextStage;
    const q = questionsRef.current[indexRef.current];
    if (!q) { setStatus("finished"); setMessage("অডিও প্র্যাকটিস শেষ! দারুণ করেছেন।"); return; }
    const delayMs = settingsRef.current.delay * 1000;
    const next = s => go(s, run);
    const wait = (s, msg) => { setMessage(msg); timerRef.current = setTimeout(() => next(s), delayMs); };
    if (nextStage === "question") {
      setMessage(`প্রশ্ন ${toBn(indexRef.current + 1)} / ${toBn(questionsRef.current.length)} শোনানো হচ্ছে…`);
      speak(`প্রশ্ন ${indexRef.current + 1}। ${q.question_text || ""}`, () => next("question-wait"), run);
    } else if (nextStage === "question-wait") {
      wait(isShort(q) || !settingsRef.current.optionPause ? "answer" : "options", `${settingsRef.current.delay} সেকেন্ড সময়: মনে মনে উত্তর ভাবুন।`);
    } else if (nextStage === "options") {
      q.__audioOptions = shuffle(getOptions(q));
      speak(q.__audioOptions.map((o, i) => `অপশন ${LETTERS[i]}। ${o.text}`).join("। "), () => next("options-wait"), run);
    } else if (nextStage === "options-wait") {
      wait("answer", `${settingsRef.current.delay} সেকেন্ড সময়: সঠিক অপশনটি মনে মনে বেছে নিন।`);
    } else if (nextStage === "answer") {
      let answer;
      if (isShort(q)) answer = q.short_answer || q.explanation || "এই প্রশ্নের উত্তর সংরক্ষিত নেই।";
      else {
        const correctKey = String(q.correct_option || "").toLowerCase();
        const pos = (q.__audioOptions || []).findIndex(o => o.key === correctKey);
        const correctText = q[`option_${correctKey}`] || "উত্তর সংরক্ষিত নেই।";
        answer = pos >= 0 ? `সঠিক উত্তর অপশন ${LETTERS[pos]}। ${correctText}` : `সঠিক উত্তর ${correctText}`;
      }
      setMessage("সঠিক উত্তর শোনানো হচ্ছে…");
      speak(answer, () => {
        if (indexRef.current + 1 >= questionsRef.current.length) { setStatus("finished"); setMessage("অডিও প্র্যাকটিস শেষ! দারুণ করেছেন।"); }
        else { indexRef.current += 1; setIndex(indexRef.current); next("question"); }
      }, run);
    }
  }, [speak]);

  async function start() {
    setError(""); setLoading(true); stopEngine();
    try {
      let query = supabase.from("questions").select("*");
      if (subjectId) query = query.eq("subject_id", subjectId);
      if (topicId) query = query.eq("topic_id", topicId);
      const { data, error: fetchError } = await query;
      if (fetchError) throw fetchError;
      let pool = (data || []).filter(q => {
        const mcq = !isShort(q) && getOptions(q).length >= 2;
        return type === "mcq" ? mcq : type === "short" ? isShort(q) : (mcq || isShort(q));
      });
      if (!pool.length) { setError("এই ফিল্টারে কোনো প্রশ্ন পাওয়া যায়নি। বিষয়/টপিক বা প্রশ্নের ধরন পরিবর্তন করুন।"); return; }
      pool = shuffle(pool).slice(0, Math.max(1, Math.min(100, Number(count) || 20))).map(q => ({ ...q }));
      questionsRef.current = pool; indexRef.current = 0; settingsRef.current = { delay: Number(delay) || 10, optionPause, rate: Number(rate) || 1 };
      setQuestions(pool); setIndex(0); setStatus("playing"); setMessage("অডিও প্রস্তুত হচ্ছে…");
      const run = runRef.current; timerRef.current = setTimeout(() => go("question", run), 200);
    } catch (e) { setError(`প্রশ্ন লোড করা যায়নি: ${e.message || "অজানা সমস্যা"}`); }
    finally { setLoading(false); }
  }
  function pause() {
    if (status !== "playing") return;
    pausedRef.current = true; if (timerRef.current) clearTimeout(timerRef.current); timerRef.current = null;
    if (window.speechSynthesis?.speaking) window.speechSynthesis.pause();
    setStatus("paused"); setMessage("অডিও বিরতিতে আছে। Resume চাপলে আবার চলবে।");
  }
  function resume() {
    if (status !== "paused") return;
    pausedRef.current = false;
    if (window.speechSynthesis?.paused && utteranceRef.current) { window.speechSynthesis.resume(); setStatus("playing"); setMessage("অডিও চলছে…"); }
    else { setStatus("playing"); go(stageRef.current, runRef.current); }
  }
  function stop() { stopEngine(); setStatus("idle"); setMessage("অডিও বন্ধ করা হয়েছে। আবার শুরু করতে পারেন।"); setIndex(0); indexRef.current = 0; }
  function skip() {
    if (!questionsRef.current.length) return; stopEngine();
    if (indexRef.current + 1 >= questionsRef.current.length) { setStatus("finished"); setMessage("অডিও প্র্যাকটিস শেষ! দারুণ করেছেন।"); return; }
    indexRef.current += 1; setIndex(indexRef.current); setStatus("playing"); const run = runRef.current;
    timerRef.current = setTimeout(() => go("question", run), 150);
  }
  const current = questions[index]; const locked = status === "playing" || status === "paused";
  const progress = questions.length ? Math.round(((index + (status === "finished" ? 1 : 0)) / questions.length) * 100) : 0;
  return <section className="view audio-practice-page">
    <div className="page-hero audio-practice-hero"><div><span className="eyebrow">LISTEN &amp; PRACTICE</span><h1>🎧 অডিও প্র্যাকটিস</h1><p>স্ক্রিন না দেখেও প্রশ্ন শুনুন, মনে মনে উত্তর দিন, তারপর সঠিক উত্তর জেনে নিন।</p></div><div className="hero-icon">♫</div></div>
    <div className="audio-safety-note"><strong>নিরাপত্তা:</strong> বাইক চালানোর সময় বা রাস্তা পার হওয়ার সময় এটি ব্যবহার করবেন না। নিরাপদে বসে শুনুন।</div>
    <div className="audio-settings-card"><div className="section-heading-row"><div><span className="eyebrow">STEP 01</span><h2>প্র্যাকটিস সেটিংস</h2></div></div>
      <div className="audio-settings-grid">
        <label className="modern-field"><span>প্রশ্নের ধরন</span><select value={type} onChange={e => setType(e.target.value)} disabled={locked}><option value="all">সব (MCQ + Short)</option><option value="mcq">শুধু MCQ</option><option value="short">শুধু Short</option></select></label>
        <label className="modern-field"><span>বিষয় (ঐচ্ছিক)</span><select value={subjectId} onChange={e => { setSubjectId(e.target.value); setTopicId(""); }} disabled={locked}><option value="">সব বিষয়</option>{subjects.map(s => <option key={s.id} value={s.id}>{s.name_bn || s.name}</option>)}</select></label>
        <label className="modern-field"><span>টপিক (ঐচ্ছিক)</span><select value={topicId} onChange={e => setTopicId(e.target.value)} disabled={locked || !topicChoices.length}><option value="">সব টপিক</option>{topicChoices.map(t => <option key={t.id} value={t.id}>{t.name_bn || t.name}</option>)}</select></label>
        <label className="modern-field"><span>প্রশ্ন সংখ্যা</span><select value={count} onChange={e => setCount(e.target.value)} disabled={locked}>{[10,20,30,50,100].map(n => <option key={n} value={n}>{toBn(n)}টি</option>)}</select></label>
        <label className="modern-field"><span>প্রতি বিরতি</span><select value={delay} onChange={e => setDelay(e.target.value)} disabled={locked}><option value="5">৫ সেকেন্ড</option><option value="10">১০ সেকেন্ড</option><option value="15">১৫ সেকেন্ড</option></select></label>
        <label className="modern-field"><span>কণ্ঠের গতি</span><select value={rate} onChange={e => setRate(e.target.value)} disabled={locked}><option value="0.8">ধীরে</option><option value="1">স্বাভাবিক</option><option value="1.15">দ্রুত</option></select></label>
      </div>
      <label className="audio-checkbox-row"><input type="checkbox" checked={optionPause} onChange={e => setOptionPause(e.target.checked)} disabled={locked} /> MCQ অপশন পড়ার পরও উত্তর ভাবার জন্য বিরতি দিন</label>
      <div className="audio-settings-actions"><button className="cta-primary cta-large" onClick={start} disabled={loading || locked}>{loading ? "প্রশ্ন লোড হচ্ছে…" : "🎧 অডিও প্র্যাকটিস শুরু করুন"}</button>{locked && <button className="cta-secondary" onClick={status === "playing" ? pause : resume}>{status === "playing" ? "Ⅱ Pause" : "▶ Resume"}</button>}{(locked || status === "finished") && <button className="cta-secondary" onClick={stop}>■ Stop</button>}</div>
      {error && <p className="audio-error" role="alert">{error}</p>}
    </div>
    <div className="audio-player-card" aria-live="polite"><div className="audio-player-top"><span className="audio-live-dot" />{status === "playing" ? "অডিও চলছে" : status === "paused" ? "বিরতিতে" : status === "finished" ? "সম্পন্ন" : "প্রস্তুত"}</div><div className="audio-player-icon">{status === "playing" ? "♫" : status === "paused" ? "Ⅱ" : status === "finished" ? "✓" : "🎧"}</div><h2>{message}</h2>
      {questions.length > 0 && <><div className="audio-progress-meta"><span>প্রশ্ন {toBn(Math.min(index + 1, questions.length))} / {toBn(questions.length)}</span><span>{toBn(progress)}%</span></div><div className="audio-progress-track"><div style={{ width: `${progress}%` }} /></div></>}
      {current && status !== "idle" && <div className="audio-current-question"><span className="field-kicker">বর্তমান প্রশ্ন (ঐচ্ছিক)</span><p>{current.question_text}</p></div>}{status === "finished" && <p className="audio-finished-note">সব প্রশ্ন শেষ হয়েছে। নতুন সেট দিয়ে আবার অনুশীলন করতে পারেন।</p>}
      <div className="audio-player-bottom"><span>{locked ? "হেডফোন ব্যবহার করুন এবং মনে মনে উত্তর দিন।" : "প্রশ্নের ক্রম প্রতিবার এলোমেলো হবে।"}</span>{locked && <button className="cta-secondary" onClick={skip}>পরের প্রশ্ন →</button>}</div>
    </div><p className="audio-browser-note">নোট: অডিও আপনার ব্রাউজারের Text-to-Speech কণ্ঠ ব্যবহার করে। বাংলা কণ্ঠের প্রাপ্যতা ডিভাইসভেদে আলাদা হতে পারে। অন্য অ্যাপে গেলে বা স্ক্রিন লক করলে অডিও চালু থাকা সব ডিভাইসে নিশ্চিত নয়।</p>
  </section>;
}
