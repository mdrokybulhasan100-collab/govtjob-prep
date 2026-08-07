import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

function dayOfYear() {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 0);
  const diff = now - start;
  return Math.floor(diff / 86400000);
}

export default function DailyFactWidget() {
  const [facts, setFacts] = useState([]);
  const [index, setIndex] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    const { data } = await supabase.from("daily_facts").select("*");
    const list = data || [];
    setFacts(list);
    if (list.length) setIndex(dayOfYear() % list.length);
    setLoading(false);
  }

  function nextFact() {
    if (!facts.length) return;
    setIndex((i) => (i + 1) % facts.length);
  }

  if (loading) return null;
  if (facts.length === 0) return null;

  const fact = facts[index];

  return (
    <div className="widget-card widget-fact">
      <span className="widget-title">💡 আজকের ফ্যাক্ট</span>
      {fact.category && <span className="chip chip-level" style={{ padding: "3px 10px", fontSize: 11, marginTop: 6 }}>{fact.category}</span>}
      <p className="widget-fact-text">{fact.fact_bn}</p>
      <button className="cta-small" onClick={nextFact}>পরের ফ্যাক্ট →</button>
    </div>
  );
}
