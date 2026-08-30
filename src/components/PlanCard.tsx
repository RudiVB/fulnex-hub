import { useCallback, useEffect, useState } from "react";
import { Check, Pencil, Plus, Trash2, X } from "lucide-react";
import { supabase } from "../lib/supabase";
import { FadeUp } from "./motion";

// The business plan, as data: every row lives in plan_items and
// both admins edit it in place — same spirit as the parts list.
type PlanItem = {
  id: number; section: string; title: string; tag: string;
  body: string; foot: string; sort: number;
};

const SECTIONS = [
  { key: "revenue", h: "What earns the money", sub: "Nine streams, one company. Hardware is the face; software and recurring money are the engine." },
  { key: "people", h: "The people", sub: "" },
  { key: "years", h: "The years — as long as they take", sub: "Earn-gated, soak-proven, never date-rushed." },
  { key: "customers", h: "Where the customers come from", sub: "A target without a source is a wish. The weekly metric: 2–3 new conversations." },
  { key: "channel", h: "The installer channel — order to money", sub: "The boss sells, Olof builds, the QR activates, the rails bill monthly." },
  { key: "retail", h: "The road to shop shelves", sub: "In order. No skipping." },
  { key: "funding", h: "The money — R1,500/month, then customers", sub: "Above the gate: the monthly budget. Below it: only money FULNEX has already earned." },
  { key: "notes", h: "The rules", sub: "" },
] as const;

const EMPTY = { title: "", tag: "", body: "", foot: "" };

function Row({ item, onChange }: { item: PlanItem; onChange: () => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(EMPTY);

  const start = () => {
    setDraft({ title: item.title, tag: item.tag, body: item.body, foot: item.foot });
    setEditing(true);
  };
  const save = async () => {
    await supabase.from("plan_items").update({ ...draft, updated_at: new Date().toISOString() }).eq("id", item.id);
    setEditing(false);
    onChange();
  };
  const remove = async () => {
    await supabase.from("plan_items").delete().eq("id", item.id);
    onChange();
  };

  if (editing) {
    return (
      <div className="rounded-xl border border-brassdim bg-ground/60 p-4 space-y-2">
        <div className="flex gap-2">
          <input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })}
            placeholder="title" className="flex-1 bg-ground border border-line rounded-lg px-2.5 py-1.5 text-sm" />
          <input value={draft.tag} onChange={(e) => setDraft({ ...draft, tag: e.target.value })}
            placeholder="tag / cost" className="w-40 bg-ground border border-line rounded-lg px-2.5 py-1.5 text-sm font-mono" />
        </div>
        <textarea value={draft.body} onChange={(e) => setDraft({ ...draft, body: e.target.value })}
          placeholder="the content — one bullet per line" rows={Math.max(3, draft.body.split("\n").length + 1)}
          className="w-full bg-ground border border-line rounded-lg px-2.5 py-1.5 text-sm" />
        <div className="flex gap-2">
          <input value={draft.foot} onChange={(e) => setDraft({ ...draft, foot: e.target.value })}
            placeholder="money line / source" className="flex-1 bg-ground border border-line rounded-lg px-2.5 py-1.5 text-sm font-mono" />
          <button onClick={save} className="btn-brass rounded-lg px-3 py-1.5 text-sm inline-flex items-center gap-1.5">
            <Check size={14} /> Save
          </button>
          <button onClick={() => setEditing(false)} className="border border-line rounded-lg px-2.5 text-mute"><X size={14} /></button>
          <button onClick={remove} className="border border-line rounded-lg px-2.5 text-faint hover:text-red-400"><Trash2 size={14} /></button>
        </div>
      </div>
    );
  }

  const bullets = item.body.split("\n").map((s) => s.trim()).filter(Boolean);
  return (
    <div className="group relative rounded-xl border border-line bg-ground/60 p-4">
      <button onClick={start}
        className="absolute right-3 top-3 opacity-0 group-hover:opacity-100 transition-opacity text-faint hover:text-ink">
        <Pencil size={13} />
      </button>
      {(item.title || item.tag) && (
        <div className="flex items-baseline justify-between gap-3 pr-6">
          {item.title && <div className="font-medium text-[15px]">{item.title}</div>}
          {item.tag && <div className="text-[10px] font-mono uppercase tracking-widest text-brass shrink-0">{item.tag}</div>}
        </div>
      )}
      {bullets.length > 1 ? (
        <ul className={`space-y-1.5 ${item.title ? "mt-2" : ""}`}>
          {bullets.map((b, i) => (
            <li key={i} className="flex gap-2 text-sm text-mute leading-relaxed"><span className="text-brass shrink-0">·</span>{b}</li>
          ))}
        </ul>
      ) : (
        bullets[0] && <p className={`text-sm text-mute leading-relaxed ${item.title ? "mt-1.5" : ""} pr-6`}>{bullets[0]}</p>
      )}
      {item.foot && <div className="text-[13px] font-mono text-brass mt-2.5">{item.foot}</div>}
    </div>
  );
}

export function PlanCard() {
  const [items, setItems] = useState<PlanItem[]>([]);

  const load = useCallback(async () => {
    const { data } = await supabase.from("plan_items").select("*").order("sort");
    setItems((data as PlanItem[]) ?? []);
  }, []);
  useEffect(() => { load(); }, [load]);

  const add = async (section: string) => {
    const max = Math.max(0, ...items.filter((i) => i.section === section).map((i) => i.sort));
    await supabase.from("plan_items").insert({ section, sort: max + 10, title: "", tag: "", body: "New line — click the pencil to write it.", foot: "" });
    load();
  };

  return (
    <FadeUp className="card p-5 sm:p-6">
      <h2 className="font-semibold text-lg mb-1">The FULNEX plan</h2>
      <p className="text-mute text-sm mb-6 leading-relaxed">
        One company, no capital, R1,500 a month until FULNEX feeds itself. Everything here is
        editable — hover a line, tap the pencil, make it yours. This page <em>is</em> the plan;
        keep it true.
      </p>
      <div className="space-y-8">
        {SECTIONS.map((s) => {
          const rows = items.filter((i) => i.section === s.key);
          if (!rows.length) return null;
          return (
            <div key={s.key}>
              <div className="flex items-baseline justify-between mb-0.5">
                <h3 className="text-[12px] font-mono uppercase tracking-widest text-ink">{s.h}</h3>
                <button onClick={() => add(s.key)}
                  className="text-faint hover:text-ink inline-flex items-center gap-1 text-[11px] font-mono">
                  <Plus size={12} /> add
                </button>
              </div>
              {s.sub && <p className="text-faint text-xs mb-2.5">{s.sub}</p>}
              {!s.sub && <div className="mb-2.5" />}
              <div className={s.key === "revenue" ? "grid sm:grid-cols-2 gap-3" : "space-y-2.5"}>
                {rows.map((i) => <Row key={i.id} item={i} onChange={load} />)}
              </div>
            </div>
          );
        })}
      </div>
    </FadeUp>
  );
}
