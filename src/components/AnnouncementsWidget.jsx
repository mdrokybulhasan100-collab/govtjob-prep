import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

export default function AnnouncementsWidget() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from("announcements")
      .select("*")
      .order("published_at", { ascending: false })
      .limit(5);
    setItems(data || []);
    setLoading(false);
  }

  if (loading) return null;
  if (items.length === 0) return null;

  return (
    <div className="widget-card">
      <span className="widget-title">📢 সাম্প্রতিক বিজ্ঞপ্তি</span>
      <ul className="announce-list">
        {items.map((a) => (
          <li key={a.id}>
            {a.url ? (
              <a href={a.url} target="_blank" rel="noreferrer">{a.title}</a>
            ) : (
              <span>{a.title}</span>
            )}
            <span className="announce-meta">{a.source ? `${a.source} · ` : ""}{a.published_at}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
