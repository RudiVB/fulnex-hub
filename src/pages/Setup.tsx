import { Link } from "react-router-dom";

const steps = [
  {
    title: "Get the firmware",
    body: (
      <>
        <p className="mb-3">
          Two files. The sketch is the same for every device; the config is personal —
          it carries your device's serial and secret key, so it comes with your device,
          not from this page.
        </p>
        <div className="flex flex-wrap gap-3 mb-3">
          <a
            href="/firmware/fulnex_hub.ino"
            download
            className="btn-brass font-medium rounded-lg px-4 py-2 text-sm hover:opacity-90"
          >
            Download fulnex_hub.ino
          </a>
          <a
            href="/firmware/config.example.h"
            download
            className="border border-line rounded-lg px-4 py-2 text-sm hover:border-brassdim"
          >
            Download config.example.h
          </a>
        </div>
        <p className="text-faint text-sm">
          Put both in a folder named <code className="font-mono text-brass">fulnex_hub</code>,
          rename the example to <code className="font-mono text-brass">config.h</code>, and
          fill in the serial + key you received.
        </p>
      </>
    ),
  },
  {
    title: "Prepare Arduino IDE",
    body: (
      <>
        <p className="mb-2">One-time setup:</p>
        <ul className="space-y-1.5 text-sm">
          <li>
            <span className="text-brass font-mono text-xs mr-2">boards</span>
            File → Preferences → Additional Board URLs:{" "}
            <code className="font-mono text-xs text-brass break-all">
              https://espressif.github.io/arduino-esp32/package_esp32_index.json
            </code>{" "}
            then install <b className="font-medium text-ink">esp32 by Espressif</b> in Board Manager
          </li>
          <li>
            <span className="text-brass font-mono text-xs mr-2">libs</span>
            Library Manager → install <b className="font-medium text-ink">WiFiManager</b> (tzapu),{" "}
            <b className="font-medium text-ink">OneWire</b>, <b className="font-medium text-ink">DallasTemperature</b>
          </li>
          <li>
            <span className="text-brass font-mono text-xs mr-2">board</span>
            Tools → Board → <b className="font-medium text-ink">ESP32 Dev Module</b>, pick your COM port, Upload
          </li>
        </ul>
      </>
    ),
  },
  {
    title: "Wire a sensor (optional but fun)",
    body: (
      <>
        <p className="mb-2 text-sm">
          The device works bare — it reports its heartbeat either way. To measure something:
        </p>
        <ul className="space-y-1.5 text-sm">
          <li>
            <span className="text-brass font-mono text-xs mr-2">temp</span>
            DS18B20 probe: red → 3V3 · black → GND · yellow → GPIO 32, with a 4.7 kΩ
            resistor between yellow and red
          </li>
          <li>
            <span className="text-brass font-mono text-xs mr-2">soil</span>
            Moisture sensor AOUT → GPIO 33 (set <code className="font-mono text-xs text-brass">ENABLE_SOIL 1</code> in config.h)
          </li>
          <li>
            <span className="text-brass font-mono text-xs mr-2">level</span>
            HY-SRF05: TRIG → GPIO 25 · ECHO → GPIO 26 via divider (set{" "}
            <code className="font-mono text-xs text-brass">ENABLE_ULTRASONIC 1</code>)
          </li>
        </ul>
      </>
    ),
  },
  {
    title: "Connect it to your Wi-Fi",
    body: (
      <>
        <p className="text-sm mb-2">
          Power the board from any USB charger. On your phone: Wi-Fi →
          join <b className="font-medium text-ink">FULNEX-&lt;your serial&gt;</b> → a setup page
          pops up by itself → pick your home network, enter its password. Done — it
          remembers forever.
        </p>
        <p className="text-faint text-sm">
          LED language: <span className="text-ink">solid</span> = online ·{" "}
          <span className="text-ink">double-flash</span> = just reported ·{" "}
          <span className="text-ink">fast blink</span> = wrong serial/key ·{" "}
          <span className="text-ink">dark</span> = reconnecting
        </p>
      </>
    ),
  },
  {
    title: "Claim it",
    body: (
      <>
        <p className="text-sm mb-4">
          Sign in, claim your device with its serial + claim code, and watch it appear.
          Within a minute of being online it reports — and its charts begin.
        </p>
        <Link
          to="/claim"
          className="inline-block btn-brass font-medium rounded-lg px-5 py-2 text-sm hover:opacity-90"
        >
          Claim your device
        </Link>
      </>
    ),
  },
];

export default function Setup() {
  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl sm:text-[28px] font-semibold tracking-tight mb-1">Set up your device</h1>
      <p className="text-mute mb-8">
        From box to first reading in about ten minutes. Nothing to install on your phone.
      </p>
      <ol className="space-y-4">
        {steps.map((s, i) => (
          <li key={s.title} className="card p-5">
            <div className="flex items-baseline gap-3 mb-2">
              <span className="font-mono text-xs text-brass border border-line rounded-md px-2 py-0.5">
                {String(i + 1).padStart(2, "0")}
              </span>
              <h2 className="font-medium">{s.title}</h2>
            </div>
            <div className="text-mute pl-0 sm:pl-12">{s.body}</div>
          </li>
        ))}
      </ol>
    </div>
  );
}
