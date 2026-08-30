import { CaseViewer } from "../components/CaseViewer";
import { FadeUp } from "../components/motion";

// The FLX-HUB-1 design dossier — Rev C, the sealed hub.
// Public and unlinked: share /case with anyone who builds or inspects.

const ARCHITECTURE = [
  {
    t: "Bluetooth senses — the pucks",
    d: "Temp/humidity, door, motion: small battery pucks you stick anywhere. They broadcast; the hub listens. No pairing, no limit — one hub hears every puck in the house. Months per battery, and it's the CR2032 every till in the country sells.",
  },
  {
    t: "Wired senses — the two rear jacks",
    d: "P1 is the temperature bus: up to 8 probes daisy-chained on one cable — geyser, pool, fridge. P2 takes any single wired sense. Wires win where a probe must physically touch something: no battery, R30 instead of R250.",
  },
  {
    t: "Switching lives elsewhere",
    d: "Things that control fans, lights, pumps or a geyser are their own powered products (the Biltong Cabinet already works this way — it talks straight to the cloud). The pro 12-port breakout becomes FLX-IO, a separate module for business installs.",
  },
];

const HOLES: { where: string; hole: string; why: string }[] = [
  { where: "Front face", hole: "No openings — the debossed tagline", why: "\"YOUR THINGS, WATCHED\" pressed into the plastic where ports used to be. The face you see says what it does; the plugs live where you don't look." },
  { where: "Rear", hole: "USB window", why: "The cable plugs STRAIGHT into the ESP's own USB connector — the deck docks the board right behind this window. Power in, and factory provisioning through the same hole, lid never opened. No power module, no extra parts." },
  { where: "Left side, near the back", hole: "2 jack holes — P1 (GPIO32) · P2 (GPIO33)", why: "The wired escape hatch: P1 = 8-probe temperature bus, P2 = any sense. Tip = signal, ring = 3V3, sleeve = GND. Invisible from the front — plug in once, forget." },
  { where: "Lid, top face", hole: "1 tiny hole below the FULNEX deboss", why: "The light pipe — a clear filament stub carries the status LED to the surface. The breathing dot from the renders." },
  { where: "Base, underside", hole: "4 countersunk screw holes", why: "The only screws in the product, hidden underneath — they reach up into the lid's posts. Top and sides stay seamless." },
  { where: "Base, underside", hole: "34 mm square recess", why: "The QR label: serial, claim code, and the QR the customer scans to claim." },
  { where: "Base, underside", hole: "2 keyhole slots", why: "Hang the hub on a wall with two screws. Slots run both directions, so you choose: logo upright, or cable exiting downward." },
  { where: "Base, floor", hole: "8 vent slots", why: "Airflow under the electronics, positioned beneath the board." },
  { where: "Inside", hole: "4 standoffs · 1 spare tray · 1 zip-tie bridge", why: "The ESP deck screws onto the standoffs, docking the board's USB at the rear window. The tray is spare space for a future module; the jack harness runs under the deck, tied to the bridge." },
];

const STEPS: string[] = [
  "Print all three parts in matte black PETG — the lid face-down for a crisp FULNEX deboss. Press a clear filament stub into the light-pipe hole.",
  "Press the two jacks into the left-side holes (P1 temp bus, P2 universal), nuts on the inside.",
  "Snap the ESP32 DevKit into the deck — front corners under the cradles, USB end held by the side clips, pin headers hanging through.",
  "Screw the deck onto the four standoffs (M2.5) — the board's USB connector now sits at the rear window. That's the whole power system.",
  "Wire the two jacks (tip = signal, ring = 3V3, sleeve = GND) and tie the harness to the bridge under the deck.",
  "Lid on. Four countersunk screws from underneath. QR label into the base recess.",
  "Provision through the rear window: plug in USB, paste the FULNEX-PROVISION line, done — the lid never comes back off.",
  "QC before boxing: hold BOOT while powering on — jig mode prints every input. No pin unproven.",
];

export default function CasePage() {
  return (
    <div className="mx-auto max-w-3xl px-4 sm:px-6 py-10 pb-16">
      <FadeUp>
        <div className="text-[10px] font-mono uppercase tracking-[0.25em] text-brass mb-1">FLX-HUB-1 · REV C</div>
        <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight mb-1">The sealed hub</h1>
        <p className="text-mute text-sm mb-5">
          Hands-free by design: senses reach it over Bluetooth, two wired probes plug in
          at the back once, and the face carries nothing but the light. Drag to inspect —
          this is the actual print geometry.
        </p>
        <CaseViewer />
      </FadeUp>

      {/* ---- the architecture ---- */}
      <FadeUp className="mt-10" delay={0.05}>
        <h2 className="text-[11px] font-mono uppercase tracking-[0.2em] text-brass mb-3">
          How senses reach it — wires where they touch, Bluetooth where they roam
        </h2>
        <div className="space-y-2.5">
          {ARCHITECTURE.map((a) => (
            <div key={a.t} className="border border-line rounded-xl px-4 py-3.5">
              <div className="text-sm font-medium mb-0.5">{a.t}</div>
              <p className="text-mute text-sm leading-relaxed">{a.d}</p>
            </div>
          ))}
        </div>
        <p className="text-faint text-xs font-mono mt-3">
          one ESP32 runs all of it — Wi-Fi to the cloud, Bluetooth listening, and the wired bus, simultaneously
        </p>
      </FadeUp>

      {/* ---- every opening ---- */}
      <FadeUp className="mt-10" delay={0.08}>
        <h2 className="text-[11px] font-mono uppercase tracking-[0.2em] text-brass mb-3">
          Every opening, and why
        </h2>
        <div className="space-y-2.5">
          {HOLES.map((h) => (
            <div key={h.hole} className="border border-line rounded-xl px-4 py-3">
              <div className="flex flex-wrap items-baseline gap-2">
                <span className="text-[10px] font-mono uppercase tracking-wider text-faint">{h.where}</span>
                <span className="text-sm font-medium">{h.hole}</span>
              </div>
              <p className="text-mute text-sm mt-0.5 leading-relaxed">{h.why}</p>
            </div>
          ))}
        </div>
      </FadeUp>

      {/* ---- assembly ---- */}
      <FadeUp className="mt-10" delay={0.1}>
        <h2 className="text-[11px] font-mono uppercase tracking-[0.2em] text-brass mb-3">
          Assembly — eight steps, one sitting
        </h2>
        <ol className="space-y-2.5">
          {STEPS.map((s, i) => (
            <li key={i} className="flex gap-3.5 border border-line rounded-xl px-4 py-3">
              <span className="font-mono text-brass text-xs pt-0.5 w-5 shrink-0">{String(i + 1).padStart(2, "0")}</span>
              <p className="text-mute text-sm leading-relaxed">{s}</p>
            </li>
          ))}
        </ol>
        <p className="text-faint text-xs font-mono mt-6 text-center">
          FLX-HUB-1 · 120 × 120 × 40 mm · matte black PETG · designed in South Africa
        </p>
      </FadeUp>

      {/* ---- the puck ---- */}
      <FadeUp className="mt-14" delay={0.12}>
        <div className="text-[10px] font-mono uppercase tracking-[0.25em] text-brass mb-1">FLX-PUCK-1 · REV A</div>
        <h2 className="text-xl font-semibold tracking-tight mb-1">The sense puck</h2>
        <p className="text-mute text-sm mb-4">
          Ø46 mm, stick anywhere. Inside: an ESP32-C3 broadcasting over Bluetooth as a
          deep-sleep beacon — wake, read, shout once, sleep — months on the CR2032
          coin cell sold at every till. The face carries FULNEX, the light dot, and what it is: the{" "}
          face says what it does — <span className="font-mono text-ink">TEMP · HUMIDITY</span> —
          debossed straight into the plastic. The whole sense family is designed, each in
          the body its job demands: the <span className="text-ink">door pair</span> (slim
          bar on the frame + battery-free magnet block, alignment lines meeting across the
          gap), <span className="text-ink">motion</span> (the same dome with the PIR's
          fresnel lens breaking through the centre — stick it high, it watches the room),
          and <span className="text-ink">leak</span> (a low disc that stands on two
          stainless screw-heads — the screws are the electrodes; water bridges them and
          it shouts). All in the viewer above.
        </p>
        <ul className="text-mute text-sm space-y-1.5">
          <li className="flex gap-2"><span className="text-brass">·</span> <span className="text-ink">Twist-lock base — no tools, ever:</span> three lugs enter the rim notches, a small twist locks it. Battery flat? Twist open, swap the CR2032, twist shut. Same on motion and leak; the door bar's back clicks in on spring tabs.</li>
          <li className="flex gap-2"><span className="text-brass">·</span> Cell pocket, board pillars, vent slots, and a keyhole so it hangs on one screw or sticks with a tape pad.</li>
          <li className="flex gap-2"><span className="text-brass">·</span> Shell prints face-down: flawless dome, and the wordmark is debossed in Michroma — the same letterforms as the site and the app.</li>
          <li className="flex gap-2"><span className="text-brass">·</span> The hub already listens for it — puck broadcasts use the beacon format the firmware ingests today.</li>
        </ul>
      </FadeUp>

      {/* ---- the geyser switch ---- */}
      <FadeUp className="mt-14" delay={0.14}>
        <div className="text-[10px] font-mono uppercase tracking-[0.25em] text-brass mb-1">FLX-GEYSER-1 · REV A</div>
        <h2 className="text-xl font-semibold tracking-tight mb-1">The geyser switch</h2>
        <p className="text-mute text-sm mb-4">
          The money product: a wall box by the DB board, wired in once by an electrician.
          It powers itself from mains and switches the geyser's <span className="text-ink">contactor
          coil</span> — the heavy current never enters our box. The wired probe goes into
          the geyser's sleeve. Schedules, load-shedding dodging, "water's hot" on your phone,
          and the biggest line on the electricity bill finally answers to someone.
        </p>
        <ul className="text-mute text-sm space-y-1.5">
          <li className="flex gap-2"><span className="text-brass">·</span> Two chambers behind a full-height barrier: mains PSU + relay on one side, the ESP brain and probe jack on the other. Wires cross one small slot.</li>
          <li className="flex gap-2"><span className="text-brass">·</span> Two cable glands (supply in, coil out) and the temp-probe jack on the bottom edge; keyholes in the back; FULNEX · dot · GEYSER on the lid.</li>
          <li className="flex gap-2"><span className="text-brass">·</span> Installer product: four serviceable lid screws, electrician installation, and pilot shells are bench-prototypes — production moves to V0-rated plastic.</li>
        </ul>
      </FadeUp>

      {/* ---- pro & garden ---- */}
      <FadeUp className="mt-14" delay={0.16}>
        <div className="text-[10px] font-mono uppercase tracking-[0.25em] text-brass mb-1">THE PRO & GARDEN TAIL</div>
        <h2 className="text-xl font-semibold tracking-tight mb-1">FLX-IO, soil, level</h2>
        <p className="text-mute text-sm mb-4">
          The last three pieces of the catalogue — where the wires work for a living.
        </p>
        <ul className="text-mute text-sm space-y-1.5">
          <li className="flex gap-2"><span className="text-brass">·</span> <span className="text-ink">FLX-IO</span> — the 12-port pro module: the jack faceplate the consumer hub retired, reborn for workshops and machine rooms. Twelve senses on the front, three switched outputs at the back, powered and provisioned through the same USB window, running the same one-binary firmware.</li>
          <li className="flex gap-2"><span className="text-brass">·</span> <span className="text-ink">Soil spike head</span> — a printed cap that seals the capacitive soil probe's electronics against rain (the reason garden probes die); blade in the dirt, cable out the top.</li>
          <li className="flex gap-2"><span className="text-brass">·</span> <span className="text-ink">Tank level bracket</span> — aims the ultrasonic sensor straight down into a rain tank or borehole reservoir; the flange's slots forgive sloppy drilling.</li>
        </ul>
        <p className="text-faint text-xs font-mono mt-4">
          nine products · every enclosure in the family designed · nothing undrawn
        </p>
      </FadeUp>
    </div>
  );
}
