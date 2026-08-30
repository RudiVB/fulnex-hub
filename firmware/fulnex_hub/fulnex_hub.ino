// ============================================================
//  FULNEX firmware v2.0.0 — one binary for every device
//
//  The 2.0 idea: the firmware no longer knows who it is at
//  compile time. Identity (serial/key/claim/mqtt) and the port
//  map live in NVS flash, written once at provisioning over USB
//  serial. config.h only supplies FALLBACK defaults — a legacy
//  device OTA-ing onto 2.0 self-seeds its NVS from them, and
//  from then on every build is generic.
//
//  Everything from 1.x, plus:
//   - NVS identity + serial provisioning:
//       FULNEX-PROVISION serial=FLX-0005 key=abc claim=ABC123 mqtt=flx-xyz
//       FULNEX-PM ow=32,dht=5,ct=4,o1=22L,o2=21L,o3=19L
//       FULNEX-INFO / FULNEX-WIPE
//   - Runtime port map (NVS "pm", cloud-updatable via desired.pm;
//     a changed map saves + reboots into the new wiring)
//   - Desired state persists in NVS: outputs, interval, reflex,
//     climate autopilot — a power cut can't disarm the meat
//   - QC jig mode: hold BOOT while powering on -> outputs cycle,
//     inputs print every 2 s, no Wi-Fi needed (the GPIO25 rule)
//   - OTA rollback mark-valid + loop watchdog (fed each loop,
//     detached before OTA so a slow download can't bite)
//
//  Port map string: comma tokens key=pin with flags L (active
//  LOW) and P (PWM, o1 only). Keys: ow pot ct mot dht soil soil2
//  ut ue vb o1 o2 o3 buz. Omitted keys keep config.h defaults.
//
//  Ports: 1-3 temp · 4 analog · 5 contact · 6 motion · 8/9 DHT
//         10/12 soil · 11 level · 20 mains · 21-23 output echo
//         30-32 BLE climate (experimental)
//
//  Libraries: WiFiManager (tzapu), OneWire, DallasTemperature,
//             PubSubClient, DHT sensor library.
//  Board: ESP32 Dev Module.
// ============================================================

#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>
#include <HTTPUpdate.h>
#include <WiFiManager.h>
#include <ArduinoOTA.h>
#include <OneWire.h>
#include <DallasTemperature.h>
#include <PubSubClient.h>
#include <DHT.h>
#include <Preferences.h>
#include <time.h>
#include <esp_task_wdt.h>
#include <esp_ota_ops.h>
#include "config.h"

// the firmware owns its version — config.h no longer does
#undef FIRMWARE_VERSION
#define FIRMWARE_VERSION "2.1.0"
// 2.1.0: continuous BLE listening for FULNEX senses (8-slot table,
// event-driven), FULNEX + ATC frame parsing, geyser schedule
// (windows + target temp on the P1 probe, device-side, tz-aware)

#if ENABLE_BLE_SCAN
#include <NimBLEDevice.h>
#endif

Preferences prefs;

// ---- identity: NVS first, config.h as fallback + seed --------
String gSerial, gKey, gClaim, gMqtt;

// ---- runtime port map ---------------------------------------
struct Pins {
  int ow, pot, ct, mot, dht, soil, soil2, ut, ue, vb;
  int o1, o2, o3, buz;
  int o1Act, o2Act, o3Act;   // HIGH or LOW
  bool o1Pwm;
} P;

String gPmStored;            // the raw map string in NVS ("" = defaults)

void pinsFromConfig() {
  P.ow = ONEWIRE_PIN;  P.pot = POT_PIN;    P.ct = CONTACT_PIN;
  P.mot = MOTION_PIN;  P.dht = DHT_PIN;    P.soil = SOIL_PIN;
  P.soil2 = SOIL2_PIN; P.ut = ULTRA_TRIG_PIN; P.ue = ULTRA_ECHO_PIN;
  P.vb = VBUS_SENSE_PIN;
  P.o1 = OUT1_PIN;  P.o2 = OUT2_PIN;  P.o3 = OUT3_PIN;  P.buz = BUZZER_PIN;
  P.o1Act = OUT1_ACTIVE;  P.o2Act = OUT2_ACTIVE;  P.o3Act = OUT3_ACTIVE;
  P.o1Pwm = OUT1_PWM != 0;
}

// apply one "key=pinFLAGS" token onto P
void applyPmToken(const String& tok) {
  int eq = tok.indexOf('=');
  if (eq <= 0) return;
  String k = tok.substring(0, eq);
  String v = tok.substring(eq + 1);
  k.trim(); v.trim();
  bool low = v.indexOf('L') >= 0 || v.indexOf('l') >= 0;
  bool pwm = v.indexOf('P') >= 0 || v.indexOf('p') >= 0;
  int pin = v.toInt();
  if (v.length() == 0) return;
  if (!isDigit(v[0]) && v[0] != '-') return;
  if (k == "ow") P.ow = pin;
  else if (k == "pot") P.pot = pin;
  else if (k == "ct") P.ct = pin;
  else if (k == "mot") P.mot = pin;
  else if (k == "dht") P.dht = pin;
  else if (k == "soil") P.soil = pin;
  else if (k == "soil2") P.soil2 = pin;
  else if (k == "ut") P.ut = pin;
  else if (k == "ue") P.ue = pin;
  else if (k == "vb") P.vb = pin;
  else if (k == "buz") P.buz = pin;
  else if (k == "o1") { P.o1 = pin; P.o1Act = low ? LOW : HIGH; P.o1Pwm = pwm; }
  else if (k == "o2") { P.o2 = pin; P.o2Act = low ? LOW : HIGH; }
  else if (k == "o3") { P.o3 = pin; P.o3Act = low ? LOW : HIGH; }
}

void applyPortMap(const String& pm) {
  int start = 0;
  while (start < (int)pm.length()) {
    int comma = pm.indexOf(',', start);
    if (comma < 0) comma = pm.length();
    applyPmToken(pm.substring(start, comma));
    start = comma + 1;
  }
}

// ---- sensor objects, created once the pins are known ---------
OneWire* oneWire = nullptr;
DallasTemperature* probes = nullptr;
DHT* dht = nullptr;

WiFiClient mqttNet;
PubSubClient mqtt(mqttNet);
String cmdTopic;
unsigned long lastMqttTry = 0;

unsigned long lastReport = 0;
unsigned long intervalMs = 60000;
int failures = 0;
bool unauthorized = false;
long lastPulseId = -1;
long lastBeepId = -1;
bool recipeMode = false;
bool otaInProgress = false;
bool qcMode = false;
bool markedValid = false;

// climate autopilot — the cabinet keeps itself right even offline
bool climEn = false;
long climRhHi = 55, climRhLo = 48;
long climTHi = 30;
long climAirOn = 5, climAirRest = 25;
float climT = -1000.0f, climRh = -1.0f;
bool climExhaust = false;
unsigned long lastClimRead = 0;

// geyser schedule — heat inside the windows until the probe says
// target, all decided on the device with local time
bool gsEn = false;
long gsTarget = 55;                     // deg C on the P1 probe
long gsW[4] = {-1, -1, -1, -1};         // s1 start/end, s2 start/end (min of day)
long tzMin = 120;                       // UTC offset minutes (SAST)
float gsTemp = -1000.0f;
unsigned long lastGsRead = 0;

// BLE sense table — the hub is the ear: continuous passive scan,
// every FULNEX/ATC broadcaster gets a stable slot (persisted)
#define BLE_SLOTS 8
struct BleSlot {
  uint8_t mac[6];
  uint8_t type;                         // 1 temp/hum · 2 door · 3 motion · 4 leak
  float v1; uint8_t v2; uint8_t batt;
  unsigned long seenMs;
  uint8_t lastSeq;
  bool used;
};
BleSlot bleSlots[BLE_SLOTS];
volatile bool bleEvent = false;

void saveBleSlots() {
  uint8_t blob[BLE_SLOTS * 7];
  for (int i = 0; i < BLE_SLOTS; i++) {
    memcpy(blob + i * 7, bleSlots[i].mac, 6);
    blob[i * 7 + 6] = bleSlots[i].used ? bleSlots[i].type : 0;
  }
  prefs.begin("fulnex", false);
  prefs.putBytes("bles", blob, sizeof(blob));
  prefs.end();
}

void loadBleSlots() {
  uint8_t blob[BLE_SLOTS * 7];
  prefs.begin("fulnex", true);
  size_t n = prefs.getBytes("bles", blob, sizeof(blob));
  prefs.end();
  if (n != sizeof(blob)) return;
  for (int i = 0; i < BLE_SLOTS; i++) {
    if (blob[i * 7 + 6] > 0) {
      memcpy(bleSlots[i].mac, blob + i * 7, 6);
      bleSlots[i].type = blob[i * 7 + 6];
      bleSlots[i].used = true;
      bleSlots[i].seenMs = 0;
    }
  }
}

int bleSlotFor(const uint8_t* mac, uint8_t type) {
  for (int i = 0; i < BLE_SLOTS; i++)
    if (bleSlots[i].used && memcmp(bleSlots[i].mac, mac, 6) == 0) return i;
  for (int i = 0; i < BLE_SLOTS; i++)
    if (!bleSlots[i].used) {
      memcpy(bleSlots[i].mac, mac, 6);
      bleSlots[i].type = type;
      bleSlots[i].used = true;
      bleSlots[i].lastSeq = 255;
      saveBleSlots();
      Serial.printf("[fulnex] new sense in slot %d (type %d)\n", i, type);
      return i;
    }
  return -1;
}

int sentContact = -999, sentMotion = -999, sentPower = -999;
int liveContact = -999;
unsigned long lastEventMs = 0;
unsigned long bootBtnDownAt = 0;

// ---- desired-state persistence -------------------------------
// Saved on change, applied at boot BEFORE Wi-Fi: a power cut
// restores fans/lights within seconds, no cloud needed.
int savedOut1 = 0;
bool savedLed2 = false, savedLed3 = false;

void persistDesired() {
  prefs.begin("fulnex", false);
  prefs.putBool("d_gsen", gsEn);
  prefs.putLong("d_gst", gsTarget);
  prefs.putLong("d_tz", tzMin);
  for (int i = 0; i < 4; i++) prefs.putLong((String("d_gsw") + i).c_str(), gsW[i]);
  prefs.putInt("d_out1", savedOut1);
  prefs.putBool("d_led2", savedLed2);
  prefs.putBool("d_led3", savedLed3);
  prefs.putULong("d_intv", intervalMs);
  prefs.putBool("d_rcp", recipeMode);
  prefs.putBool("d_clen", climEn);
  prefs.putLong("d_clrhh", climRhHi);
  prefs.putLong("d_clrhl", climRhLo);
  prefs.putLong("d_clth", climTHi);
  prefs.putLong("d_claon", climAirOn);
  prefs.putLong("d_clar", climAirRest);
  prefs.end();
}

void restoreDesired() {
  prefs.begin("fulnex", true);
  gsEn = prefs.getBool("d_gsen", false);
  gsTarget = prefs.getLong("d_gst", 55);
  tzMin = prefs.getLong("d_tz", 120);
  for (int i = 0; i < 4; i++) gsW[i] = prefs.getLong((String("d_gsw") + i).c_str(), -1);
  savedOut1 = prefs.getInt("d_out1", 0);
  savedLed2 = prefs.getBool("d_led2", false);
  savedLed3 = prefs.getBool("d_led3", false);
  intervalMs = prefs.getULong("d_intv", 60000);
  recipeMode = prefs.getBool("d_rcp", false);
  climEn = prefs.getBool("d_clen", false);
  climRhHi = prefs.getLong("d_clrhh", 55);
  climRhLo = prefs.getLong("d_clrhl", 48);
  climTHi = prefs.getLong("d_clth", 30);
  climAirOn = prefs.getLong("d_claon", 5);
  climAirRest = prefs.getLong("d_clar", 25);
  prefs.end();
}

// ---- offline buffer ------------------------------------------
struct Buffered { time_t epoch; uint8_t port; float value; char kind[10]; };
#define BUF_MAX 120
Buffered buf[BUF_MAX];
int bufCount = 0;

void bufferPush(uint8_t port, float value, const char* kind) {
  if (bufCount >= BUF_MAX) {
    memmove(buf, buf + 1, sizeof(Buffered) * (BUF_MAX - 1));
    bufCount = BUF_MAX - 1;
  }
  buf[bufCount].epoch = time(nullptr);
  buf[bufCount].port = port;
  buf[bufCount].value = value;
  strncpy(buf[bufCount].kind, kind, 9);
  buf[bufCount].kind[9] = 0;
  bufCount++;
}

// ---- FULNEX-branded captive portal (runtime identity) --------
String gPortalHtml;

void buildPortalHtml() {
  gPortalHtml =
    "<style>"
    "body{background:#08090a;color:#f4f3f0;font-family:'Segoe UI',Roboto,Arial,sans-serif;}"
    "h1,h2,h3{font-weight:400;letter-spacing:.25em;text-transform:uppercase;}"
    "button{background:linear-gradient(180deg,#f7f6f2,#cfcec8);color:#0a0b0c;border:0;"
    "border-radius:10px;height:44px;font-weight:600;letter-spacing:.02em;}"
    "button:hover{filter:brightness(1.05);}"
    "input,select{background:#0e0f11!important;color:#f4f3f0!important;"
    "border:1px solid #26292e!important;border-radius:8px!important;height:38px;}"
    "a{color:#dddcd5;}"
    ".msg{background:#0e0f11;border-left:2px solid #dddcd5;color:#9a9c9e;border-radius:0 8px 8px 0;}"
    ".q{color:#9a9c9e;}"
    "</style>"
    "<div style='text-align:center;margin:16px 0 2px;font-size:11px;"
    "letter-spacing:.35em;color:#5e6165'>YOUR THINGS, WATCHED</div>"
    "<div style='text-align:center;margin:6px 0 0;font-size:12px;color:#9a9c9e'>"
    "Serial <b style='color:#f4f3f0'>" + gSerial + "</b> &middot; "
    "Claim code <b style='color:#f4f3f0'>" + gClaim + "</b><br>"
    "<span style='font-size:11px'>After Wi-Fi: claim it at " CLAIM_BASE + gSerial + "</span></div>";
}

// ---- helpers -------------------------------------------------
long numFromBody(const String& body, const char* key, long fallback) {
  int i = body.indexOf(key);
  if (i < 0) return fallback;
  return body.substring(i + strlen(key)).toInt();
}

String strFromBody(const String& body, const char* key) {
  int i = body.indexOf(key);
  if (i < 0) return "";
  int a = body.indexOf('"', i + strlen(key));
  if (a < 0) return "";
  int b = body.indexOf('"', a + 1);
  if (b < 0) return "";
  return body.substring(a + 1, b);
}

int appliedOut1 = 0;
int appliedOut2 = 0;
int appliedOut3 = 0;

int offLvl(int act) { return act == HIGH ? LOW : HIGH; }

void setOut1Duty(int pct) {
  if (P.o1 < 0) return;
  if (pct < 0) pct = 0;
  if (pct > 100) pct = 100;
  appliedOut1 = pct;
  if (P.o1Pwm) {
    int duty = pct * 255 / 100;
    if (P.o1Act == LOW) duty = 255 - duty;
#if defined(ESP_ARDUINO_VERSION_MAJOR) && ESP_ARDUINO_VERSION_MAJOR >= 3
    ledcWrite(P.o1, duty);
#else
    ledcWrite(0, duty);
#endif
  } else {
    digitalWrite(P.o1, pct > 0 ? P.o1Act : offLvl(P.o1Act));
  }
  if (savedOut1 != pct) { savedOut1 = pct; persistDesired(); }
}

void setOut2(bool on) {
  if (P.o2 < 0) return;
  digitalWrite(P.o2, on ? P.o2Act : offLvl(P.o2Act));
  appliedOut2 = on ? 1 : 0;
  if (savedLed2 != on) { savedLed2 = on; persistDesired(); }
}

void setOut3(bool on) {
  if (P.o3 < 0) return;
  digitalWrite(P.o3, on ? P.o3Act : offLvl(P.o3Act));
  appliedOut3 = on ? 1 : 0;
  if (savedLed3 != on) { savedLed3 = on; persistDesired(); }
}

bool ledBase = false;
void setStatusLed(bool on) { digitalWrite(LED_PIN, on ? LED_ACTIVE : !LED_ACTIVE); }
void flashLed(int times, int onMs, int offMs) {
  for (int i = 0; i < times; i++) {
    setStatusLed(false); delay(offMs);
    setStatusLed(true);  delay(onMs);
  }
  setStatusLed(ledBase);
}

void beep(int times) {
  if (P.buz < 0) return;
  for (int i = 0; i < times; i++) {
    digitalWrite(P.buz, HIGH); delay(90);
    digitalWrite(P.buz, LOW);  delay(90);
  }
}

void bootFade() {
  for (int p = 0; p <= 60; p += 4) { setOut1Duty(p); delay(12); }
  for (int p = 60; p >= 0; p -= 4) { setOut1Duty(p); delay(12); }
  setOut1Duty(0);
}

const char* bootReason() {
  switch (esp_reset_reason()) {
    case ESP_RST_POWERON: return "power-on";
    case ESP_RST_SW: return "software";
    case ESP_RST_PANIC: return "crash";
    case ESP_RST_BROWNOUT: return "brownout";
    case ESP_RST_TASK_WDT: case ESP_RST_INT_WDT: case ESP_RST_WDT: return "watchdog";
    case ESP_RST_DEEPSLEEP: return "deep-sleep";
    default: return "other";
  }
}

void isoFromEpoch(time_t t, char* out, size_t n) {
  struct tm tmv;
  gmtime_r(&t, &tmv);
  strftime(out, n, "%Y-%m-%dT%H:%M:%SZ", &tmv);
}

void addReading(String& json, bool& first, int port, const String& value,
                const char* kind, time_t epoch = 0) {
  if (!first) json += ",";
  json += "{\"port\":" + String(port) + ",\"value\":" + value +
          ",\"kind\":\"" + kind + "\"";
  if (epoch > 1700000000) {
    char iso[24];
    isoFromEpoch(epoch, iso, sizeof(iso));
    json += ",\"ts\":\"" + String(iso) + "\"";
  }
  json += "}";
  first = false;
}

// ---- current senses -> array (for send + buffering) ----------
struct Current { uint8_t port; float value; const char* kind; };
Current cur[44];                        // wired + up to 8 BLE senses
int curCount = 0;

#if ENABLE_BLE_SCAN
void bleScanInto();
#endif

void readSenses() {
  curCount = 0;

  if (probes) {
    probes->requestTemperatures();
    int n = probes->getDeviceCount();
    if (n > 3) n = 3;
    for (int i = 0; i < n && curCount < 44; i++) {
      float t = probes->getTempCByIndex(i);
      if (t > -100 && t < 125) cur[curCount++] = { (uint8_t)(1 + i), t, "temp" };
    }
  }
  if (P.pot >= 0 && curCount < 44) {
    long sum = 0;
    for (int i = 0; i < 8; i++) { sum += analogRead(P.pot); delay(2); }
    cur[curCount++] = { 4, (float)(sum / 8.0f * 100.0f / 4095.0f), "analog" };
  }
  if (P.ct >= 0 && curCount < 44) {
    int closed = digitalRead(P.ct) == LOW ? 1 : 0;
    cur[curCount++] = { 5, (float)closed, "contact" };
    sentContact = closed;
  }
  if (P.mot >= 0 && curCount < 44) {
    int m = digitalRead(P.mot) == HIGH ? 1 : 0;
    cur[curCount++] = { 6, (float)m, "motion" };
    sentMotion = m;
  }
  if (dht && curCount < 43) {
    float t = dht->readTemperature();
    float h = dht->readHumidity();
    if (!isnan(t)) cur[curCount++] = { 8, t, "temp" };
    if (!isnan(h)) cur[curCount++] = { 9, h, "humidity" };
  }
  if (P.soil >= 0 && curCount < 44) {
    long sum = 0;
    for (int i = 0; i < 8; i++) { sum += analogRead(P.soil); delay(2); }
    cur[curCount++] = { 10, (float)(100.0f - sum / 8.0f * 100.0f / 4095.0f), "moisture" };
  }
  if (P.soil2 >= 0 && curCount < 44) {
    long sum = 0;
    for (int i = 0; i < 8; i++) { sum += analogRead(P.soil2); delay(2); }
    cur[curCount++] = { 12, (float)(100.0f - sum / 8.0f * 100.0f / 4095.0f), "moisture" };
  }
  if (P.ut >= 0 && P.ue >= 0 && curCount < 44) {
    digitalWrite(P.ut, LOW); delayMicroseconds(4);
    digitalWrite(P.ut, HIGH); delayMicroseconds(10);
    digitalWrite(P.ut, LOW);
    unsigned long us = pulseIn(P.ue, HIGH, 30000);
    if (us > 0) cur[curCount++] = { 11, us / 58.0f, "level" };
  }
  if (P.vb >= 0 && curCount < 44) {
    int p = analogRead(P.vb) > 1000 ? 1 : 0;
    cur[curCount++] = { 20, (float)p, "contact" };
    sentPower = p;
  }

  // outputs report back what they're actually doing
  if (P.o1 >= 0 && curCount < 44) cur[curCount++] = { 21, (float)appliedOut1, "analog" };
  if (P.o2 >= 0 && curCount < 44) cur[curCount++] = { 22, (float)appliedOut2, "contact" };
  if (P.o3 >= 0 && curCount < 44) cur[curCount++] = { 23, (float)appliedOut3, "contact" };

#if ENABLE_BLE_SCAN
  // every sense heard in the last 5 minutes joins the report:
  // slot i owns ports 30+i*3 (value), +1 (extra), +2 (battery)
  for (int i = 0; i < BLE_SLOTS && curCount < 41; i++) {
    if (!bleSlots[i].used || bleSlots[i].seenMs == 0) continue;
    if (millis() - bleSlots[i].seenMs > 5UL * 60UL * 1000UL) continue;
    uint8_t base = 30 + i * 3;
    switch (bleSlots[i].type) {
      case 1:
        cur[curCount++] = { base, bleSlots[i].v1, "temp" };
        cur[curCount++] = { (uint8_t)(base + 1), (float)bleSlots[i].v2, "humidity" };
        break;
      case 2: cur[curCount++] = { base, bleSlots[i].v1, "contact" }; break;
      case 3: cur[curCount++] = { base, bleSlots[i].v1, "motion" }; break;
      case 4: cur[curCount++] = { base, bleSlots[i].v1 > 0 ? 100.0f : 0.0f, "moisture" }; break;
    }
    if (bleSlots[i].batt > 0 && curCount < 44)
      cur[curCount++] = { (uint8_t)(base + 2), (float)bleSlots[i].batt, "battery" };
  }
#endif
}

#if ENABLE_BLE_SCAN
// The ear: continuous passive scan; every FULNEX frame (and any
// ATC-format puck) lands in its slot the moment it's shouted.
class FulnexScanCB : public NimBLEScanCallbacks {
  void onResult(const NimBLEAdvertisedDevice* d) override {
    uint8_t mac[6];
    memcpy(mac, d->getAddress().getBase()->val, 6);

    // FULNEX frame in manufacturer data
    if (d->haveManufacturerData()) {
      std::string md = d->getManufacturerData();
      if (md.length() >= 11 && md[2] == 'F' && md[3] == 'X') {
        uint8_t type = (uint8_t)md[5];
        int slot = bleSlotFor(mac, type);
        if (slot < 0) return;
        uint8_t seqv = (uint8_t)md[10];
        if (seqv == bleSlots[slot].lastSeq) return;      // same shout
        bleSlots[slot].lastSeq = seqv;
        int16_t v1 = (int16_t)((uint8_t)md[6] | ((uint8_t)md[7] << 8));
        float value = type == 1 ? v1 / 10.0f : (v1 >= 5 ? 1.0f : 0.0f);
        bool changed = bleSlots[slot].type >= 2 && value != bleSlots[slot].v1
                       && bleSlots[slot].seenMs != 0;
        bleSlots[slot].v1 = value;
        bleSlots[slot].v2 = (uint8_t)md[8];
        bleSlots[slot].batt = (uint8_t)md[9];
        bleSlots[slot].seenMs = millis();
        if (changed) bleEvent = true;                    // door opened etc.
        return;
      }
    }
    // ATC 0x181A (Xiaomi pucks, and our TEMP compat frame)
    if (d->haveServiceData()) {
      std::string sd = d->getServiceData(NimBLEUUID((uint16_t)0x181A));
      if (sd.length() >= 11) {
        int slot = bleSlotFor(mac, 1);
        if (slot < 0) return;
        int16_t t = (int8_t)sd[6] << 8 | (uint8_t)sd[7];
        bleSlots[slot].v1 = t / 10.0f;
        bleSlots[slot].v2 = (uint8_t)sd[8];
        bleSlots[slot].batt = (uint8_t)sd[9];
        bleSlots[slot].seenMs = millis();
      }
    }
  }
};
FulnexScanCB fulnexScanCB;

void startBleListening() {
  NimBLEDevice::init("");
  NimBLEScan* scan = NimBLEDevice::getScan();
  scan->setScanCallbacks(&fulnexScanCB, false);
  scan->setActiveScan(false);
  scan->setInterval(160);                // 100 ms
  scan->setWindow(48);                   // 30 ms — plays nice with Wi-Fi
  scan->setDuplicateFilter(false);
  scan->start(0, false, true);           // forever
  Serial.println("[fulnex] BLE ear open — listening for senses");
}
#endif

// ---- controls (shared by HTTPS replies and MQTT messages) ----
void report();

void applyControls(const String& body) {
  long secs = numFromBody(body, "\"interval\":", -1);
  if (secs >= 10 && secs <= 3600 && (unsigned long)(secs * 1000UL) != intervalMs) {
    intervalMs = secs * 1000UL;
    persistDesired();
  }

  // a new port map: store it and reboot into the new wiring
  String pm = strFromBody(body, "\"pm\":");
  if (pm.length() > 0 && pm != gPmStored) {
    Serial.printf("[fulnex] new port map: %s — rebooting to apply\n", pm.c_str());
    prefs.begin("fulnex", false);
    prefs.putString("pm", pm);
    prefs.end();
    delay(300);
    ESP.restart();
  }

  // climate autopilot settings, parsed before the manual toggles
  bool wasClimEn = climEn;
  if (body.indexOf("\"cl_en\":true") >= 0)  climEn = true;
  if (body.indexOf("\"cl_en\":false") >= 0) { climEn = false; climExhaust = false; }
  long v;
  bool climChanged = climEn != wasClimEn;
  v = numFromBody(body, "\"cl_rh_hi\":", -1);    if (v >= 1 && v <= 100 && v != climRhHi) { climRhHi = v; climChanged = true; }
  v = numFromBody(body, "\"cl_rh_lo\":", -1);    if (v >= 0 && v <= 99 && v != climRhLo)  { climRhLo = v; climChanged = true; }
  v = numFromBody(body, "\"cl_t_hi\":", -1);     if (v >= 5 && v <= 60 && v != climTHi)   { climTHi = v; climChanged = true; }
  v = numFromBody(body, "\"cl_air_on\":", -1);   if (v >= 0 && v <= 60 && v != climAirOn) { climAirOn = v; climChanged = true; }
  v = numFromBody(body, "\"cl_air_rest\":", -1); if (v >= 0 && v <= 240 && v != climAirRest) { climAirRest = v; climChanged = true; }
  if (climRhLo >= climRhHi) climRhLo = climRhHi - 1;
  if (climChanged) persistDesired();

  // geyser schedule settings
  bool gsChanged = false;
  if (body.indexOf("\"g_en\":true") >= 0 && !gsEn)  { gsEn = true;  gsChanged = true; }
  if (body.indexOf("\"g_en\":false") >= 0 && gsEn)  { gsEn = false; gsChanged = true; setOut1Duty(0); }
  v = numFromBody(body, "\"g_t\":", -1);    if (v >= 30 && v <= 75 && v != gsTarget) { gsTarget = v; gsChanged = true; }
  v = numFromBody(body, "\"tz\":", -9999);  if (v >= -720 && v <= 840 && v != tzMin) { tzMin = v; gsChanged = true; }
  const char* gk[4] = { "\"g_s1a\":", "\"g_s1b\":", "\"g_s2a\":", "\"g_s2b\":" };
  for (int i = 0; i < 4; i++) {
    v = numFromBody(body, gk[i], -9999);
    if (v >= -1 && v < 1440 && v != gsW[i]) { gsW[i] = v; gsChanged = true; }
  }
  if (gsChanged) persistDesired();

  if (body.indexOf("\"led\":true") >= 0 || body.indexOf("\"led\":false") >= 0) {
    bool ledOn = body.indexOf("\"led\":true") >= 0;
    long bri = numFromBody(body, "\"brightness\":", 100);
    setOut1Duty(ledOn ? (int)bri : 0);
  }

  // while the autopilot is enabled it owns outputs 2 & 3
  if (!climEn) {
    if (body.indexOf("\"led2\":true") >= 0)  setOut2(true);
    if (body.indexOf("\"led2\":false") >= 0) setOut2(false);
    if (body.indexOf("\"led3\":true") >= 0)  setOut3(true);
    if (body.indexOf("\"led3\":false") >= 0) setOut3(false);

    long pid = numFromBody(body, "\"pulse_id\":", -1);
    if (pid >= 0 && P.o2 >= 0) {
      if (lastPulseId < 0) lastPulseId = pid;
      else if (pid > lastPulseId) {
        long ms = numFromBody(body, "\"pulse_ms\":", 500);
        if (ms < 50) ms = 50;
        if (ms > 2000) ms = 2000;
        digitalWrite(P.o2, P.o2Act); delay(ms); digitalWrite(P.o2, offLvl(P.o2Act));
        lastPulseId = pid;
        Serial.printf("[fulnex] pulse %ldms (id %ld)\n", ms, pid);
      }
    }
  } else {
    long pid = numFromBody(body, "\"pulse_id\":", -1);
    if (pid > lastPulseId) lastPulseId = pid;   // track, never fire stale
  }

  long bid = numFromBody(body, "\"beep_id\":", -1);
  if (bid >= 0) {
    if (lastBeepId < 0) lastBeepId = bid;
    else if (bid > lastBeepId) { beep(3); lastBeepId = bid; }
  }

  if (body.indexOf("\"recipe\":true") >= 0 && !recipeMode)  { recipeMode = true; persistDesired(); }
  if (body.indexOf("\"recipe\":false") >= 0 && recipeMode)  { recipeMode = false; persistDesired(); }

  // cloud OTA
  String fwVer = strFromBody(body, "\"fw_ver\":");
  String fwUrl = strFromBody(body, "\"fw_url\":");
  if (fwVer.length() && fwUrl.length() && fwVer != FIRMWARE_VERSION && !otaInProgress) {
    otaInProgress = true;
    Serial.printf("[fulnex] cloud OTA -> %s\n", fwVer.c_str());
    esp_task_wdt_delete(NULL);          // a slow download must not trip the WDT
    WiFiClientSecure otaClient;
    otaClient.setInsecure();            // pinning: after supervised bench test
    t_httpUpdate_return r = httpUpdate.update(otaClient, fwUrl);
    Serial.printf("[fulnex] OTA result %d\n", (int)r);   // success reboots
    esp_task_wdt_add(NULL);
    otaInProgress = false;
  }
}

// ---- report --------------------------------------------------
void report() {
  if (WiFi.status() != WL_CONNECTED) {
    readSenses();
    for (int i = 0; i < curCount; i++) bufferPush(cur[i].port, cur[i].value, cur[i].kind);
    return;
  }

  readSenses();

  String json = "{\"serial\":\"" + gSerial + "\",\"key\":\"" + gKey +
                "\",\"fw\":\"" FIRMWARE_VERSION "\",\"rssi\":";
  json += String(WiFi.RSSI());
  json += ",\"uptime\":" + String(millis() / 1000UL);
  json += ",\"heap\":" + String(ESP.getFreeHeap());
  json += ",\"boot\":\"" + String(bootReason()) + "\"";
  json += ",\"readings\":[";
  bool first = true;
  for (int i = 0; i < bufCount; i++)
    addReading(json, first, buf[i].port, String(buf[i].value, 2), buf[i].kind, buf[i].epoch);
  for (int i = 0; i < curCount; i++)
    addReading(json, first, cur[i].port, String(cur[i].value, 2), cur[i].kind);
  json += "]}";

  WiFiClientSecure client;
  client.setInsecure();
  HTTPClient http;
  http.setTimeout(10000);
  if (!http.begin(client, INGEST_URL)) return;
  http.addHeader("Content-Type", "application/json");
  int status = http.POST(json);
  String body = http.getString();
  http.end();

  Serial.printf("[fulnex] report -> %d %s\n", status, body.c_str());

  if (status == 200) {
    failures = 0;
    unauthorized = false;
    bufCount = 0;
    if (!markedValid) {
      // this image reached the cloud — never roll back from it
      esp_ota_mark_app_valid_cancel_rollback();
      markedValid = true;
    }
    flashLed(2, 60, 60);
    applyControls(body);
  } else if (status == 401) {
    unauthorized = true;
  } else {
    failures++;
    for (int i = 0; i < curCount; i++)
      bufferPush(cur[i].port, cur[i].value, cur[i].kind);
    if (failures >= 10) {
      Serial.println("[fulnex] too many failures, rebooting");
      ESP.restart();
    }
  }
}

// ---- climate autopilot ---------------------------------------
void climateTick() {
  if (!climEn || !dht || P.o3 < 0) return;
  unsigned long now = millis();
  if (now - lastClimRead >= 5000) {
    lastClimRead = now;
    float t = dht->readTemperature();
    float h = dht->readHumidity();
    if (!isnan(t)) climT = t;
    if (!isnan(h)) climRh = h;
  }
  if (climRh < 0) return;

  if (!climExhaust && climRh >= (float)climRhHi) climExhaust = true;
  if (climExhaust && climRh <= (float)climRhLo)  climExhaust = false;
  bool hot = climT > -100 && climT >= (float)climTHi;

  unsigned long cyc = (unsigned long)(climAirOn + climAirRest) * 60000UL;
  bool air = climAirOn > 0 &&
             (cyc == 0 || (now % cyc) < (unsigned long)climAirOn * 60000UL);

  bool changed = false;
  int want3 = (climExhaust || hot) ? 1 : 0;
  if (want3 != appliedOut3) {
    setOut3(want3 == 1);
    changed = true;
    Serial.printf("[fulnex] autopilot: exhaust %s (%.1f %%RH, %.1f C)\n",
                  want3 ? "ON" : "off", climRh, climT);
  }
  if (P.o2 >= 0) {
    int want2 = (air || hot) ? 1 : 0;
    if (want2 != appliedOut2) {
      setOut2(want2 == 1);
      changed = true;
      Serial.printf("[fulnex] autopilot: airflow %s\n", want2 ? "ON" : "off");
    }
  }
  if (changed && now - lastEventMs > 2000) {
    lastEventMs = now;
    report();
    lastReport = millis();
  }
}

// ---- geyser schedule -----------------------------------------
// Heat (output 1 = contactor coil) inside the windows until the
// P1 probe reads the target. Local time = NTP + tz. Fully on the
// device: load-shedding, dead routers, none of it matters.
void scheduleTick() {
  if (!gsEn) return;
  time_t now = time(nullptr);
  if (now < 1700000000) return;          // no NTP yet
  long mod = ((now + tzMin * 60) % 86400) / 60;   // minutes of local day
  bool inWindow =
    (gsW[0] >= 0 && gsW[1] >= 0 && mod >= gsW[0] && mod < gsW[1]) ||
    (gsW[2] >= 0 && gsW[3] >= 0 && mod >= gsW[2] && mod < gsW[3]);

  if (probes && millis() - lastGsRead > 30000) {
    lastGsRead = millis();
    probes->requestTemperatures();
    float t = probes->getTempCByIndex(0);
    if (t > -100 && t < 125) gsTemp = t;
  }
  // with a probe: heat to target inside the window; without one,
  // the window alone decides
  bool wantHeat = inWindow && (gsTemp < -100 || gsTemp < (float)gsTarget - 0.5f);
  int want = wantHeat ? 100 : 0;
  if (want != appliedOut1) {
    setOut1Duty(want);
    Serial.printf("[fulnex] geyser %s (%.1f C, target %ld)\n",
                  want ? "HEATING" : "off", gsTemp, gsTarget);
    if (millis() - lastEventMs > 2000) {
      lastEventMs = millis();
      report();
      lastReport = millis();
    }
  }
}

// ---- events --------------------------------------------------
void checkEvents() {
  int nowContact = -999;
  if (P.ct >= 0) {
    nowContact = digitalRead(P.ct) == LOW ? 1 : 0;
    if (recipeMode && nowContact != liveContact) {
      setOut1Duty(nowContact ? 100 : 0);
    }
    liveContact = nowContact;
  }

  bool changed = false;
  if (P.ct >= 0 && sentContact != -999 && nowContact != sentContact) changed = true;
  if (P.mot >= 0 && sentMotion != -999 &&
      (digitalRead(P.mot) == HIGH ? 1 : 0) != sentMotion) changed = true;
  if (P.vb >= 0 && sentPower != -999 &&
      (analogRead(P.vb) > 1000 ? 1 : 0) != sentPower) changed = true;
  if (bleEvent) { changed = true; bleEvent = false; }
  if (changed && millis() - lastEventMs > 2000) {
    lastEventMs = millis();
    Serial.println("[fulnex] event -> immediate report");
    report();
    lastReport = millis();
  }
}

// ---- factory reset: hold BOOT (GPIO0) for 5 s ----------------
void checkFactoryReset() {
  if (digitalRead(0) == LOW) {
    if (bootBtnDownAt == 0) bootBtnDownAt = millis();
    else if (millis() - bootBtnDownAt > 5000) {
      Serial.println("[fulnex] FACTORY RESET — wiping Wi-Fi");
      flashLed(6, 60, 60);
      WiFi.disconnect(true, true);
      delay(500);
      ESP.restart();
    }
  } else {
    bootBtnDownAt = 0;
  }
}

// ---- serial provisioning -------------------------------------
// FULNEX-PROVISION serial=FLX-0005 key=<hex> claim=ABC123 mqtt=flx-xyz [pm=...]
// FULNEX-PM ow=32,dht=5,o1=22L      FULNEX-INFO      FULNEX-WIPE
String kvFrom(const String& line, const char* key) {
  String pat = String(key) + "=";
  int i = line.indexOf(pat);
  if (i < 0) return "";
  int end = line.indexOf(' ', i);
  if (end < 0) end = line.length();
  return line.substring(i + pat.length(), end);
}

void handleSerial() {
  if (!Serial.available()) return;
  String line = Serial.readStringUntil('\n');
  line.trim();
  if (line.length() == 0) return;

  if (line.startsWith("FULNEX-PROVISION ")) {
    String s = kvFrom(line, "serial"), k = kvFrom(line, "key");
    String c = kvFrom(line, "claim"), m = kvFrom(line, "mqtt");
    String pm = kvFrom(line, "pm");
    if (s.length() < 4 || k.length() < 8) {
      Serial.println("[fulnex] provision: need at least serial= and key=");
      return;
    }
    prefs.begin("fulnex", false);
    prefs.putString("serial", s);
    prefs.putString("key", k);
    if (c.length()) prefs.putString("claim", c);
    if (m.length()) prefs.putString("mqtt", m);
    if (pm.length()) prefs.putString("pm", pm);
    prefs.end();
    Serial.printf("[fulnex] provisioned as %s — rebooting\n", s.c_str());
    delay(300);
    ESP.restart();
  } else if (line.startsWith("FULNEX-PM ")) {
    String pm = line.substring(10);
    pm.trim();
    prefs.begin("fulnex", false);
    prefs.putString("pm", pm);
    prefs.end();
    Serial.printf("[fulnex] port map saved: %s — rebooting\n", pm.c_str());
    delay(300);
    ESP.restart();
  } else if (line == "FULNEX-INFO") {
    Serial.printf("[fulnex] serial=%s claim=%s fw=%s pm=%s\n",
                  gSerial.c_str(), gClaim.c_str(), FIRMWARE_VERSION,
                  gPmStored.length() ? gPmStored.c_str() : "(defaults)");
    Serial.printf("[fulnex] pins ow=%d pot=%d ct=%d mot=%d dht=%d soil=%d/%d "
                  "ultra=%d/%d vb=%d o1=%d(%s%s) o2=%d o3=%d\n",
                  P.ow, P.pot, P.ct, P.mot, P.dht, P.soil, P.soil2,
                  P.ut, P.ue, P.vb, P.o1, P.o1Act == LOW ? "L" : "H",
                  P.o1Pwm ? "P" : "", P.o2, P.o3);
  } else if (line == "FULNEX-WIPE") {
    prefs.begin("fulnex", false);
    prefs.clear();
    prefs.end();
    WiFi.disconnect(true, true);
    Serial.println("[fulnex] identity + Wi-Fi wiped — rebooting");
    delay(300);
    ESP.restart();
  }
}

// ---- QC jig mode: hold BOOT while powering on ----------------
// No Wi-Fi. Outputs cycle one by one; every input prints every
// 2 s. This is the GPIO25 rule as a ritual: no pin untested.
void qcLoop() {
  static unsigned long lastPrint = 0;
  static unsigned long lastStep = 0;
  static int step = 0;

  if (millis() - lastStep > 700) {
    lastStep = millis();
    step = (step + 1) % 4;
    setOut1Duty(step == 1 ? 100 : 0);
    if (P.o2 >= 0) digitalWrite(P.o2, step == 2 ? P.o2Act : offLvl(P.o2Act));
    if (P.o3 >= 0) digitalWrite(P.o3, step == 3 ? P.o3Act : offLvl(P.o3Act));
    setStatusLed(step % 2 == 0);
  }

  if (millis() - lastPrint > 2000) {
    lastPrint = millis();
    Serial.printf("[QC] out step %d |", step);
    if (P.ct >= 0)  Serial.printf(" ct=%d", digitalRead(P.ct));
    if (P.mot >= 0) Serial.printf(" mot=%d", digitalRead(P.mot));
    if (P.pot >= 0) Serial.printf(" pot=%d", analogRead(P.pot));
    if (P.vb >= 0)  Serial.printf(" vb=%d", analogRead(P.vb));
    if (dht) {
      float t = dht->readTemperature(), h = dht->readHumidity();
      Serial.printf(" dht=%.1fC/%.0f%%", isnan(t) ? -1 : t, isnan(h) ? -1 : h);
    }
    if (probes) {
      probes->requestTemperatures();
      Serial.printf(" ow=%.1fC(x%d)", probes->getTempCByIndex(0), probes->getDeviceCount());
    }
    Serial.println();
  }
  handleSerial();
}

// --------------------------------------------------------------
#if ENABLE_MQTT
void mqttCallback(char* topic, byte* payload, unsigned int len) {
  String body;
  body.reserve(len);
  for (unsigned int i = 0; i < len; i++) body += (char)payload[i];
  Serial.printf("[fulnex] mqtt cmd: %s\n", body.c_str());
  applyControls(body);
}

void mqttMaintain() {
  if (mqtt.connected()) { mqtt.loop(); return; }
  if (millis() - lastMqttTry < 15000) return;
  lastMqttTry = millis();
  String cid = String("fulnex-") + gSerial + "-" + String((uint32_t)esp_random(), HEX);
  if (mqtt.connect(cid.c_str())) {
    mqtt.subscribe(cmdTopic.c_str());
    Serial.println("[fulnex] mqtt connected — instant commands live");
  }
}
#endif

// --------------------------------------------------------------
void setup() {
  Serial.begin(115200);
  Serial.setTimeout(200);
  pinMode(LED_PIN, OUTPUT);
  setStatusLed(false);
  pinMode(0, INPUT_PULLUP);

  // ---- identity: NVS first, config.h fallback + self-seed ----
  prefs.begin("fulnex", true);
  gSerial = prefs.getString("serial", "");
  gKey = prefs.getString("key", "");
  gClaim = prefs.getString("claim", "");
  gMqtt = prefs.getString("mqtt", "");
  gPmStored = prefs.getString("pm", "");
  prefs.end();

  if (gSerial.length() == 0) {
    gSerial = DEVICE_SERIAL;
    gKey = DEVICE_KEY;
    gClaim = CLAIM_CODE;
    gMqtt = MQTT_SECRET;
    if (gSerial != "FLX-0000" && gKey.length() > 0) {
      // a legacy build carrying real identity: seed NVS once,
      // and every future (generic) OTA keeps it
      prefs.begin("fulnex", false);
      prefs.putString("serial", gSerial);
      prefs.putString("key", gKey);
      prefs.putString("claim", gClaim);
      prefs.putString("mqtt", gMqtt);
      prefs.end();
      Serial.println("[fulnex] identity seeded into NVS from build config");
    }
  }

  // ---- port map: config defaults, NVS overrides --------------
  pinsFromConfig();
  if (gPmStored.length() > 0) applyPortMap(gPmStored);

  Serial.printf("[fulnex] %s fw %s%s\n", gSerial.c_str(), FIRMWARE_VERSION,
                gSerial == "FLX-0000" ? " (UNPROVISIONED — send FULNEX-PROVISION)" : "");

  // ---- desired state back from flash, outputs first ----------
  restoreDesired();

  // ---- init hardware from the runtime map --------------------
  if (P.ow >= 0) {
    oneWire = new OneWire(P.ow);
    probes = new DallasTemperature(oneWire);
    probes->begin();
    Serial.printf("[fulnex] %d temp probe(s) on the bus\n", probes->getDeviceCount());
  }
  if (P.dht >= 0) {
    dht = new DHT(P.dht, DHT22);
    dht->begin();
  }
  if (P.ct >= 0)  pinMode(P.ct, INPUT_PULLUP);
  if (P.mot >= 0) pinMode(P.mot, INPUT);
  if (P.ut >= 0)  { pinMode(P.ut, OUTPUT); }
  if (P.ue >= 0)  { pinMode(P.ue, INPUT); }
  if (P.o2 >= 0)  {
    digitalWrite(P.o2, offLvl(P.o2Act));
    pinMode(P.o2, OUTPUT);
    digitalWrite(P.o2, offLvl(P.o2Act));
  }
  if (P.o3 >= 0)  {
    digitalWrite(P.o3, offLvl(P.o3Act));
    pinMode(P.o3, OUTPUT);
    digitalWrite(P.o3, offLvl(P.o3Act));
  }
  if (P.buz >= 0) { pinMode(P.buz, OUTPUT); digitalWrite(P.buz, LOW); }
  if (P.o1 >= 0) {
    if (P.o1Pwm) {
#if defined(ESP_ARDUINO_VERSION_MAJOR) && ESP_ARDUINO_VERSION_MAJOR >= 3
      ledcAttach(P.o1, 5000, 8);
#else
      ledcSetup(0, 5000, 8);
      ledcAttachPin(P.o1, 0);
#endif
    } else {
      digitalWrite(P.o1, offLvl(P.o1Act));
      pinMode(P.o1, OUTPUT);
      digitalWrite(P.o1, offLvl(P.o1Act));
    }
  }

  // ---- QC jig mode gate: BOOT held at power-up ----------------
  delay(60);
  if (digitalRead(0) == LOW) {
    delay(150);
    if (digitalRead(0) == LOW) {
      qcMode = true;
      Serial.println("[fulnex] QC JIG MODE — outputs cycle, inputs print. Reset to exit.");
      return;                          // no Wi-Fi, no cloud
    }
  }

  // ---- restore what the world looked like before the cut -----
  if (savedOut1 > 0) setOut1Duty(savedOut1);
  else if (P.o1Pwm) bootFade();
  if (!climEn) {                       // autopilot re-decides on its own
    if (savedLed2) setOut2(true);
    if (savedLed3) setOut3(true);
  }

  // ---- Wi-Fi -------------------------------------------------
  buildPortalHtml();
  WiFiManager wm;
  wm.setTitle("FULNEX");
  wm.setCustomHeadElement(gPortalHtml.c_str());
  wm.setConfigPortalTimeout(300);
  String ap = String("FULNEX-") + gSerial;
  if (!wm.autoConnect(ap.c_str())) {
    Serial.println("[fulnex] no wifi, rebooting to retry");
    ESP.restart();
  }
  WiFi.setAutoReconnect(true);
  Serial.printf("[fulnex] online: %s (%d dBm)\n",
                WiFi.localIP().toString().c_str(), WiFi.RSSI());

  configTime(0, 0, "pool.ntp.org", "time.google.com");

  ArduinoOTA.setHostname(ap.c_str());
  ArduinoOTA.begin();

#if ENABLE_MQTT
  cmdTopic = String("fulnex/") + gSerial + "/" + gMqtt + "/cmd";
  mqtt.setServer(MQTT_HOST, MQTT_PORT);
  mqtt.setCallback(mqttCallback);
  mqtt.setBufferSize(512);
#endif

#if ENABLE_BLE_SCAN
  loadBleSlots();
  startBleListening();
#endif

  // ---- loop watchdog: 5 min, detached during OTA -------------
#if defined(ESP_ARDUINO_VERSION_MAJOR) && ESP_ARDUINO_VERSION_MAJOR >= 3
  esp_task_wdt_config_t wdtCfg = { .timeout_ms = 300000, .idle_core_mask = 0, .trigger_panic = true };
  esp_task_wdt_reconfigure(&wdtCfg);
#else
  esp_task_wdt_init(300, true);
#endif
  esp_task_wdt_add(NULL);

  ledBase = true;
  setStatusLed(true);
  report();
  lastReport = millis();

#if ENABLE_DEEP_SLEEP
  Serial.printf("[fulnex] deep sleep %lus\n", intervalMs / 1000);
  Serial.flush();
  esp_sleep_enable_timer_wakeup((uint64_t)intervalMs * 1000ULL);
  esp_deep_sleep_start();
#endif
}

void loop() {
  if (qcMode) { qcLoop(); return; }

  esp_task_wdt_reset();
  ArduinoOTA.handle();
  checkFactoryReset();
  handleSerial();
#if ENABLE_MQTT
  mqttMaintain();
#endif

  if (unauthorized) {
    flashLed(1, 80, 80);
    delay(200);
  }

  if (WiFi.status() != WL_CONNECTED) {
    ledBase = false;
    setStatusLed(false);
    delay(500);
    return;
  }
  ledBase = true;
  setStatusLed(true);

  checkEvents();
  climateTick();
  scheduleTick();

  if (millis() - lastReport >= intervalMs) {
    lastReport = millis();
    report();
  }
}
