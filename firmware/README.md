# Fulnex Hub firmware

Arduino sketch in `fulnex_hub/`. One folder = one flashable unit; edit
`config.h` per device (serial, key), flash, done.

## Arduino IDE setup (once)

1. **Board support**: File → Preferences → Additional Board Manager URLs:
   `https://espressif.github.io/arduino-esp32/package_esp32_index.json`
   then Tools → Board Manager → install **esp32 by Espressif**.
2. **Libraries** (Sketch → Include Library → Manage Libraries):
   - `WiFiManager` (by tzapu)
   - `OneWire`
   - `DallasTemperature`
3. **Driver**: CH340 or CP210x USB driver depending on the board.

## Flashing a unit

1. Edit `fulnex_hub/config.h` — set `DEVICE_SERIAL` and `DEVICE_KEY`
   (must match a row provisioned in the platform: see
   `../supabase/provision-device.sql`).
2. Tools → Board: **ESP32 Dev Module** → select the COM port → Upload.
3. Open Serial Monitor at 115200 to watch it live.

## First boot (what the customer does)

1. Power the board from any USB source.
2. On a phone: Wi-Fi → join **FULNEX-<serial>** → setup page pops up →
   pick home Wi-Fi, enter password.
3. The board joins the network and reports every 60 s. LED solid = online,
   double-flash = report sent, fast blink = wrong key/serial.
4. Claim it on the dashboard with the serial + claim code.

## Sensors (v0.1)

- DS18B20 probe(s) on GPIO 32: red → 3V3, black → GND, yellow → GPIO 32,
  4.7 kΩ resistor between yellow and red. Multiple probes on the same pin
  each get their own port number automatically.
- No probe connected is fine — the device still reports (heartbeat, RSSI),
  it just has no chart.

## OTA

Once on the network the unit appears in Arduino IDE under
Tools → Port → Network Ports as `FULNEX-<serial>` — reflash over Wi-Fi,
no cable. (Cloud OTA comes in a later version.)

## Not in v0.1 (planned)

BLE sense scanning · relay control · battery/deep-sleep role ·
TLS certificate pinning · cloud OTA channel
