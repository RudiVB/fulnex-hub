import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Package } from "lucide-react";
import { supabase } from "../lib/supabase";
import { FadeUp, Stagger, StaggerItem } from "../components/motion";

type Preorder = {
  id: number;
  created_at: string;
  product_code: string;
  qty: number;
  status: "waiting" | "invited" | "converted" | "cancelled";
  city: string | null;
};

const STATUS_COPY: Record<Preorder["status"], { label: string; cls: string; d: string }> = {
  waiting: { label: "in the queue", cls: "text-brass border-brassdim", d: "Waiting for a build slot. We email you the moment yours opens." },
  invited: { label: "build slot open", cls: "text-ok border-ok/40", d: "Your unit is on the bench — check your email for the next step." },
  converted: { label: "ordered", cls: "text-ok border-ok/40", d: "Confirmed and in production. Photos on the way." },
  cancelled: { label: "cancelled", cls: "text-faint border-line", d: "This reservation was cancelled." },
};

export default function Orders() {
  const [rows, setRows] = useState<Preorder[] | null>(null);
  const [names, setNames] = useState<Record<string, string>>({});
  const [positions, setPositions] = useState<Record<number, number>>({});

  useEffect(() => {
    (async () => {
      const [pre, prod] = await Promise.all([
        supabase.from("preorders").select("id, created_at, product_code, qty, status, city")
          .order("created_at", { ascending: false }),
        supabase.from("products").select("code, name"),
      ]);
      const list = (pre.data as Preorder[]) ?? [];
      setRows(list);
      setNames(Object.fromEntries(((prod.data ?? []) as { code: string; name: string }[])
        .map((p) => [p.code, p.name])));
      const pos: Record<number, number> = {};
      await Promise.all(list.filter((r) => r.status === "waiting").map(async (r) => {
        const { data } = await supabase.rpc("queue_position", { p_id: r.id });
        if (typeof data === "number") pos[r.id] = data;
      }));
      setPositions(pos);
    })();
  }, []);

  if (rows === null) return <div className="card h-40 animate-pulse" />;

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl sm:text-[28px] font-semibold tracking-tight mb-6">My orders</h1>
      {rows.length === 0 ? (
        <FadeUp className="card p-10 text-center">
          <span className="icon-chip mx-auto mb-4"><Package size={18} strokeWidth={1.75} /></span>
          <h2 className="font-medium mb-2">Nothing reserved yet</h2>
          <p className="text-mute text-sm mb-6 max-w-sm mx-auto">
            Reserve a hub or a cabinet — no payment until your build ships.
          </p>
          <Link to="/preorder" className="btn-brass font-medium rounded-lg px-5 py-2 text-sm">
            Pre-order
          </Link>
        </FadeUp>
      ) : (
        <Stagger className="space-y-3">
          {rows.map((r) => {
            const s = STATUS_COPY[r.status];
            return (
              <StaggerItem key={r.id} className="card p-5">
                <div className="flex flex-wrap items-center justify-between gap-3 mb-1">
                  <span className="font-medium">
                    {names[r.product_code] ?? r.product_code}
                    {r.qty > 1 ? ` ×${r.qty}` : ""}
                  </span>
                  <span className={`text-[10px] font-mono uppercase tracking-wider border rounded-full px-2.5 py-1 ${s.cls}`}>
                    {s.label}
                    {r.status === "waiting" && positions[r.id] ? ` · #${positions[r.id]}` : ""}
                  </span>
                </div>
                <p className="text-mute text-sm">{s.d}</p>
                <p className="text-faint text-xs font-mono mt-2">
                  reserved {new Date(r.created_at).toLocaleDateString("en-ZA")}
                  {r.city ? ` · ${r.city}` : ""}
                </p>
              </StaggerItem>
            );
          })}
        </Stagger>
      )}
    </div>
  );
}
