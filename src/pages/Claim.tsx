import { FormEvent, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "../lib/supabase";

export default function Claim() {
  const params = useParams();
  const navigate = useNavigate();
  const [serial, setSerial] = useState(params.serial ?? "");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const { data, error } = await supabase.rpc("claim_device", {
      p_serial: serial,
      p_code: code,
    });
    setBusy(false);
    if (error) {
      setError(error.message);
      return;
    }
    const result = data as { ok: boolean; error?: string; device_id?: string };
    if (!result.ok) {
      setError(result.error ?? "claim failed");
      return;
    }
    navigate(`/device/${result.device_id}`);
  }

  return (
    <div className="mx-auto max-w-sm pt-8">
      <h1 className="text-xl font-semibold mb-2">Claim a device</h1>
      <p className="text-mute text-sm mb-6">
        The serial and claim code are on the label on the bottom of your device.
      </p>
      <form onSubmit={submit} className="bg-panel border border-line rounded-xl p-6 space-y-4">
        <div>
          <label className="block text-xs font-mono uppercase tracking-widest text-brass mb-1">Serial</label>
          <input
            required
            placeholder="FLX-7F3A21"
            value={serial}
            onChange={(e) => setSerial(e.target.value.toUpperCase())}
            className="w-full bg-ground border border-line rounded-lg px-3 py-2 font-mono focus:outline-none focus:border-brass"
          />
        </div>
        <div>
          <label className="block text-xs font-mono uppercase tracking-widest text-brass mb-1">Claim code</label>
          <input
            required
            placeholder="ABCD12"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            className="w-full bg-ground border border-line rounded-lg px-3 py-2 font-mono focus:outline-none focus:border-brass"
          />
        </div>
        {error && <p className="text-danger text-sm">{error}</p>}
        <button
          disabled={busy}
          className="w-full bg-brass text-ground font-medium rounded-lg py-2 hover:opacity-90 disabled:opacity-50"
        >
          {busy ? "…" : "Claim device"}
        </button>
      </form>
    </div>
  );
}
