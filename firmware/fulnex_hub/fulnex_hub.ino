// ============================================================
//  FULNEX firmware v1.1 — the premium build
//
//  Everything in v1.0, plus:
//   - Instant commands over MQTT (site -> device in ~1 s)
//   - Cloud OTA: set desired.fw_ver + fw_url and the device
//     updates itself over HTTPS
//   - Offline buffer: readings queue in RAM through Wi-Fi/cloud
//     outages and backfill with true timestamps (NTP)
//   - Local reflex recipe: contact drives the LED on-device, ms
//     latency, cloud informed afterwards (desired.recipe)
//   - Factory reset: hold BOOT 5 s -> Wi-Fi wiped, portal opens
//   - Telemetry: uptime, free heap, boot reason on every report
//   - Boot fade hello on the LED output
//   - Setup portal shows serial + claim code + claim link
//   - EXPERIMENTAL: BLE scan for Xiaomi ATC pucks (config flag)
//
//  Ports: 1-3 temp · 4 analog · 5 contact · 6 motion · 10 soil
//         11 level · 20 mains power · 30-32 BLE climate (exp.)
//
//  Libraries: WiFiManager (tzapu), OneWire, DallasTemperature,
//             PubSubClient (Nick O'Leary).
//             + NimBLE-Arduino only if ENABLE_BLE_SCAN.
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
#include <time.h>
#include "config.h"

#if ENABLE_BLE_SCAN
#include <NimBLEDevice.h>
#endif

#if DHT_PIN >= 0
#include <DHT.h>
DHT dht(DHT_PIN, DHT22);
#endif

#if ONEWIRE_PIN >= 0
OneWire oneWire(ONEWIRE_PIN);
DallasTemperature probes(&oneWire);
#endif

#if ENABLE_MQTT
WiFiClient mqttNet;
PubSubClient mqtt(mqttNet);
String cmdTopic = String("fulnex/") + DEVICE_SERIAL + "/" + MQTT_SECRET + "/cmd";
unsigned long lastMqttTry = 0;
#endif

unsigned long lastReport = 0;
unsigned long intervalMs = 60000;
int failures = 0;
bool unauthorized = false;
long lastPulseId = -1;
long lastBeepId = -1;
bool recipeMode = false;
bool otaInProgress = false;

int sentContact = -999, sentMotion = -999, sentPower = -999;
int liveContact = -999;
unsigned long lastEventMs = 0;
unsigned long bootBtnDownAt = 0;

// ---- offline buffer ----------------------------------------
struct Buffered { time_t epoch; uint8_t port; float value; char kind[10]; };
#define BUF_MAX 120
Buffered buf[BUF_MAX];
int bufCount = 0;

void bufferPush(uint8_t port, float value, const char* kind) {
  if (bufCount >= BUF_MAX) {              // full: drop oldest
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

// ---- FULNEX-branded captive portal --------------------------
const char FULNEX_PORTAL_STYLE[] PROGMEM =
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
  "Serial <b style='color:#f4f3f0'>" DEVICE_SERIAL "</b> &middot; "
  "Claim code <b style='color:#f4f3f0'>" CLAIM_CODE "</b><br>"
  "<span style='font-size:11px'>After Wi-Fi: claim it at " CLAIM_BASE DEVICE_SERIAL "</span></div>";

// ---- helpers ------------------------------------------------
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

int appliedOut1 = 0;     // what output 1 is actually doing, 0-100
int appliedOut2 = 0;     // what output 2 is actually doing, 0/1
int appliedOut3 = 0;     // what output 3 is actually doing, 0/1

#define OUT1_OFFLVL (OUT1_ACTIVE == HIGH ? LOW : HIGH)
#define OUT2_OFFLVL (OUT2_ACTIVE == HIGH ? LOW : HIGH)
#define OUT3_OFFLVL (OUT3_ACTIVE == HIGH ? LOW : HIGH)

void setOut1Duty(int pct) {
  if (pct < 0) pct = 0;
  if (pct > 100) pct = 100;
  appliedOut1 = pct;
#if OUT1_PWM
  int duty = pct * 255 / 100;
  if (OUT1_ACTIVE == LOW) duty = 255 - duty;   // inverted drive
#if defined(ESP_ARDUINO_VERSION_MAJOR) && ESP_ARDUINO_VERSION_MAJOR >= 3
  ledcWrite(OUT1_PIN, duty);
#else
  ledcWrite(0, duty);
#endif
#else
  // relay mode: plain on/off, never PWM
  digitalWrite(OUT1_PIN, pct > 0 ? OUT1_ACTIVE : OUT1_OFFLVL);
#endif
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
#if BUZZER_PIN >= 0
  for (int i = 0; i < times; i++) {
    digitalWrite(BUZZER_PIN, HIGH); delay(90);
    digitalWrite(BUZZER_PIN, LOW);  delay(90);
  }
#endif
}

void bootFade() {                        // premium hello
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
  if (epoch > 1700000000) {              // only if NTP time is sane
    char iso[24];
    isoFromEpoch(epoch, iso, sizeof(iso));
    json += ",\"ts\":\"" + String(iso) + "\"";
  }
  json += "}";
  first = false;
}

// ---- current senses -> array (for send + buffering) ---------
struct Current { uint8_t port; float value; const char* kind; };
Current cur[12];
int curCount = 0;

void readSenses() {
  curCount = 0;

#if ONEWIRE_PIN >= 0
  probes.requestTemperatures();
  int n = probes.getDeviceCount();
  if (n > 3) n = 3;
  for (int i = 0; i < n && curCount < 12; i++) {
    float t = probes.getTempCByIndex(i);
    if (t > -100 && t < 125) cur[curCount++] = { (uint8_t)(1 + i), t, "temp" };
  }
#endif
#if POT_PIN >= 0
  if (curCount < 12) {
    long sum = 0;
    for (int i = 0; i < 8; i++) { sum += analogRead(POT_PIN); delay(2); }
    cur[curCount++] = { 4, (float)(sum / 8.0f * 100.0f / 4095.0f), "analog" };
  }
#endif
#if CONTACT_PIN >= 0
  if (curCount < 12) {
    int closed = digitalRead(CONTACT_PIN) == LOW ? 1 : 0;
    cur[curCount++] = { 5, (float)closed, "contact" };
    sentContact = closed;
  }
#endif
#if MOTION_PIN >= 0
  if (curCount < 12) {
    int m = digitalRead(MOTION_PIN) == HIGH ? 1 : 0;
    cur[curCount++] = { 6, (float)m, "motion" };
    sentMotion = m;
  }
#endif
#if DHT_PIN >= 0
  if (curCount < 11) {
    float t = dht.readTemperature();
    float h = dht.readHumidity();
    if (!isnan(t)) cur[curCount++] = { 8, t, "temp" };
    if (!isnan(h)) cur[curCount++] = { 9, h, "humidity" };
  }
#endif

#if SOIL_PIN >= 0
  if (curCount < 12) {
    long sum = 0;
    for (int i = 0; i < 8; i++) { sum += analogRead(SOIL_PIN); delay(2); }
    cur[curCount++] = { 10, (float)(100.0f - sum / 8.0f * 100.0f / 4095.0f), "moisture" };
  }
#endif

#if SOIL2_PIN >= 0
  if (curCount < 12) {
    long sum = 0;
    for (int i = 0; i < 8; i++) { sum += analogRead(SOIL2_PIN); delay(2); }
    cur[curCount++] = { 12, (float)(100.0f - sum / 8.0f * 100.0f / 4095.0f), "moisture" };
  }
#endif
#if ULTRA_TRIG_PIN >= 0 && ULTRA_ECHO_PIN >= 0
  if (curCount < 12) {
    digitalWrite(ULTRA_TRIG_PIN, LOW); delayMicroseconds(4);
    digitalWrite(ULTRA_TRIG_PIN, HIGH); delayMicroseconds(10);
    digitalWrite(ULTRA_TRIG_PIN, LOW);
    unsigned long us = pulseIn(ULTRA_ECHO_PIN, HIGH, 30000);
    if (us > 0) cur[curCount++] = { 11, us / 58.0f, "level" };
  }
#endif
#if VBUS_SENSE_PIN >= 0
  if (curCount < 12) {
    int p = analogRead(VBUS_SENSE_PIN) > 1000 ? 1 : 0;
    cur[curCount++] = { 20, (float)p, "contact" };
    sentPower = p;
  }
#endif

  // outputs report back what they're actually doing — the dashboard
  // confirms commands instead of assuming them
  if (curCount < 12) cur[curCount++] = { 21, (float)appliedOut1, "analog" };
#if OUT2_PIN >= 0
  if (curCount < 12) cur[curCount++] = { 22, (float)appliedOut2, "contact" };
#endif
#if OUT3_PIN >= 0
  if (curCount < 12) cur[curCount++] = { 23, (float)appliedOut3, "contact" };
#endif

#if ENABLE_BLE_SCAN
  bleScanInto();
#endif
}

#if ENABLE_BLE_SCAN
// Xiaomi ATC1441 advertisement: svc data 0x181A =
// mac[6] tempBE[2]x0.1C hum[1]% batt[1]% battmv[2] cnt[1]
void bleScanInto() {
  NimBLEScan* scan = NimBLEDevice::getScan();
  scan->setActiveScan(false);
  NimBLEScanResults results = scan->getResults(3000, false);
  for (int i = 0; i < results.getCount() && curCount < 12; i++) {
    const NimBLEAdvertisedDevice* d = results.getDevice(i);
    if (!d->haveServiceData()) continue;
    std::string sd = d->getServiceData(NimBLEUUID((uint16_t)0x181A));
    if (sd.length() >= 11) {
      int16_t t = (int8_t)sd[6] << 8 | (uint8_t)sd[7];
      cur[curCount++] = { 30, t / 10.0f, "temp" };
      if (curCount < 12) cur[curCount++] = { 31, (float)(uint8_t)sd[8], "humidity" };
      if (curCount < 12) cur[curCount++] = { 32, (float)(uint8_t)sd[9], "battery" };
      break;                              // first puck only, for now
    }
  }
  scan->clearResults();
}
#endif

// ---- controls (shared by HTTPS replies and MQTT messages) ---
void applyControls(const String& body) {
  long secs = numFromBody(body, "\"interval\":", -1);
  if (secs >= 10 && secs <= 3600) intervalMs = secs * 1000UL;

  if (body.indexOf("\"led\":true") >= 0 || body.indexOf("\"led\":false") >= 0) {
    bool ledOn = body.indexOf("\"led\":true") >= 0;
    long bri = numFromBody(body, "\"brightness\":", 100);
    setOut1Duty(ledOn ? (int)bri : 0);
  }

#if OUT2_PIN >= 0
  if (body.indexOf("\"led2\":true") >= 0)  { digitalWrite(OUT2_PIN, OUT2_ACTIVE); appliedOut2 = 1; }
  if (body.indexOf("\"led2\":false") >= 0) { digitalWrite(OUT2_PIN, OUT2_OFFLVL); appliedOut2 = 0; }

  long pid = numFromBody(body, "\"pulse_id\":", -1);
  if (pid >= 0) {
    if (lastPulseId < 0) lastPulseId = pid;
    else if (pid > lastPulseId) {
      long ms = numFromBody(body, "\"pulse_ms\":", 500);
      if (ms < 50) ms = 50;
      if (ms > 2000) ms = 2000;
      digitalWrite(OUT2_PIN, OUT2_ACTIVE); delay(ms); digitalWrite(OUT2_PIN, OUT2_OFFLVL);
      lastPulseId = pid;
      Serial.printf("[fulnex] pulse %ldms (id %ld)\n", ms, pid);
    }
  }
#endif

#if OUT3_PIN >= 0
  if (body.indexOf("\"led3\":true") >= 0)  { digitalWrite(OUT3_PIN, OUT3_ACTIVE); appliedOut3 = 1; }
  if (body.indexOf("\"led3\":false") >= 0) { digitalWrite(OUT3_PIN, OUT3_OFFLVL); appliedOut3 = 0; }
#endif

  long bid = numFromBody(body, "\"beep_id\":", -1);
  if (bid >= 0) {
    if (lastBeepId < 0) lastBeepId = bid;
    else if (bid > lastBeepId) { beep(3); lastBeepId = bid; }
  }

  if (body.indexOf("\"recipe\":true") >= 0)  recipeMode = true;
  if (body.indexOf("\"recipe\":false") >= 0) recipeMode = false;

  // cloud OTA
  String fwVer = strFromBody(body, "\"fw_ver\":");
  String fwUrl = strFromBody(body, "\"fw_url\":");
  if (fwVer.length() && fwUrl.length() && fwVer != FIRMWARE_VERSION && !otaInProgress) {
    otaInProgress = true;
    Serial.printf("[fulnex] cloud OTA -> %s\n", fwVer.c_str());
    WiFiClientSecure otaClient;
    otaClient.setInsecure();
    t_httpUpdate_return r = httpUpdate.update(otaClient, fwUrl);
    Serial.printf("[fulnex] OTA result %d\n", (int)r);   // success reboots
    otaInProgress = false;
  }
}

// ---- report -------------------------------------------------
void report() {
  if (WiFi.status() != WL_CONNECTED) {
    readSenses();                        // still sample, into the buffer
    for (int i = 0; i < curCount; i++) bufferPush(cur[i].port, cur[i].value, cur[i].kind);
    return;
  }

  readSenses();

  String json = "{\"serial\":\"" DEVICE_SERIAL "\",\"key\":\"" DEVICE_KEY
                "\",\"fw\":\"" FIRMWARE_VERSION "\",\"rssi\":";
  json += String(WiFi.RSSI());
  json += ",\"uptime\":" + String(millis() / 1000UL);
  json += ",\"heap\":" + String(ESP.getFreeHeap());
  json += ",\"boot\":\"" + String(bootReason()) + "\"";
  json += ",\"readings\":[";
  bool first = true;
  for (int i = 0; i < bufCount; i++)     // backfill first, real timestamps
    addReading(json, first, buf[i].port, String(buf[i].value, 2), buf[i].kind, buf[i].epoch);
  for (int i = 0; i < curCount; i++)
    addReading(json, first, cur[i].port, String(cur[i].value, 2), cur[i].kind);
  json += "]}";

  WiFiClientSecure client;
  client.setInsecure();                  // pinning: v1.2, after bench test
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
    bufCount = 0;                        // backfill delivered
    flashLed(2, 60, 60);
    applyControls(body);
  } else if (status == 401) {
    unauthorized = true;
  } else {
    failures++;
    for (int i = 0; i < curCount; i++)   // keep this sample for later
      bufferPush(cur[i].port, cur[i].value, cur[i].kind);
    if (failures >= 10) {
      Serial.println("[fulnex] too many failures, rebooting");
      ESP.restart();
    }
  }
}

// ---- events -------------------------------------------------
void checkEvents() {
#if CONTACT_PIN >= 0
  int nowContact = digitalRead(CONTACT_PIN) == LOW ? 1 : 0;
  if (recipeMode && nowContact != liveContact) {
    setOut1Duty(nowContact ? 100 : 0);   // local reflex, milliseconds
  }
  liveContact = nowContact;
#endif

  bool changed = false;
#if CONTACT_PIN >= 0
  if (sentContact != -999 && nowContact != sentContact) changed = true;
#endif
#if MOTION_PIN >= 0
  if (sentMotion != -999 &&
      (digitalRead(MOTION_PIN) == HIGH ? 1 : 0) != sentMotion) changed = true;
#endif
#if VBUS_SENSE_PIN >= 0
  if (sentPower != -999 &&
      (analogRead(VBUS_SENSE_PIN) > 1000 ? 1 : 0) != sentPower) changed = true;
#endif
  if (changed && millis() - lastEventMs > 2000) {
    lastEventMs = millis();
    Serial.println("[fulnex] event -> immediate report");
    report();
    lastReport = millis();
  }
}

// ---- factory reset: hold BOOT (GPIO0) for 5 s ---------------
void checkFactoryReset() {
  if (digitalRead(0) == LOW) {
    if (bootBtnDownAt == 0) bootBtnDownAt = millis();
    else if (millis() - bootBtnDownAt > 5000) {
      Serial.println("[fulnex] FACTORY RESET — wiping Wi-Fi");
      flashLed(6, 60, 60);
      WiFi.disconnect(true, true);       // erase stored credentials
      delay(500);
      ESP.restart();
    }
  } else {
    bootBtnDownAt = 0;
  }
}

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
  String cid = String("fulnex-") + DEVICE_SERIAL + "-" + String((uint32_t)esp_random(), HEX);
  if (mqtt.connect(cid.c_str())) {
    mqtt.subscribe(cmdTopic.c_str());
    Serial.println("[fulnex] mqtt connected — instant commands live");
  }
}
#endif

// ------------------------------------------------------------
void setup() {
  Serial.begin(115200);
  pinMode(LED_PIN, OUTPUT);
  setStatusLed(false);
  pinMode(0, INPUT_PULLUP);              // BOOT button, factory reset

#if ONEWIRE_PIN >= 0
  probes.begin();
  Serial.printf("[fulnex] %s fw %s, %d probe(s)\n",
                DEVICE_SERIAL, FIRMWARE_VERSION, probes.getDeviceCount());
#else
  Serial.printf("[fulnex] %s fw %s\n", DEVICE_SERIAL, FIRMWARE_VERSION);
#endif
#if DHT_PIN >= 0
  dht.begin();
#endif

#if CONTACT_PIN >= 0
  pinMode(CONTACT_PIN, INPUT_PULLUP);
#endif
#if MOTION_PIN >= 0
  pinMode(MOTION_PIN, INPUT);
#endif
#if ULTRA_TRIG_PIN >= 0
  pinMode(ULTRA_TRIG_PIN, OUTPUT);
  pinMode(ULTRA_ECHO_PIN, INPUT);
#endif
#if OUT2_PIN >= 0
  digitalWrite(OUT2_PIN, OUT2_OFFLVL);   // safe level before OUTPUT mode
  pinMode(OUT2_PIN, OUTPUT);
  digitalWrite(OUT2_PIN, OUT2_OFFLVL);
#endif
#if OUT3_PIN >= 0
  digitalWrite(OUT3_PIN, OUT3_OFFLVL);
  pinMode(OUT3_PIN, OUTPUT);
  digitalWrite(OUT3_PIN, OUT3_OFFLVL);
#endif
#if BUZZER_PIN >= 0
  pinMode(BUZZER_PIN, OUTPUT);
  digitalWrite(BUZZER_PIN, LOW);
#endif
#if OUT1_PWM
#if defined(ESP_ARDUINO_VERSION_MAJOR) && ESP_ARDUINO_VERSION_MAJOR >= 3
  ledcAttach(OUT1_PIN, 5000, 8);
#else
  ledcSetup(0, 5000, 8);
  ledcAttachPin(OUT1_PIN, 0);
#endif
  bootFade();                            // hello (PWM outputs only)
#else
  digitalWrite(OUT1_PIN, OUT1_OFFLVL);   // relay: come up OFF, no fade
  pinMode(OUT1_PIN, OUTPUT);
  digitalWrite(OUT1_PIN, OUT1_OFFLVL);
#endif

  WiFiManager wm;
  wm.setTitle("FULNEX");
  wm.setCustomHeadElement(FULNEX_PORTAL_STYLE);
  wm.setConfigPortalTimeout(300);
  String ap = String("FULNEX-") + DEVICE_SERIAL;
  if (!wm.autoConnect(ap.c_str())) {
    Serial.println("[fulnex] no wifi, rebooting to retry");
    ESP.restart();
  }
  WiFi.setAutoReconnect(true);
  Serial.printf("[fulnex] online: %s (%d dBm)\n",
                WiFi.localIP().toString().c_str(), WiFi.RSSI());

  configTime(0, 0, "pool.ntp.org", "time.google.com");  // UTC for buffering

  ArduinoOTA.setHostname(ap.c_str());
  ArduinoOTA.begin();

#if ENABLE_MQTT
  mqtt.setServer(MQTT_HOST, MQTT_PORT);
  mqtt.setCallback(mqttCallback);
  mqtt.setBufferSize(512);
#endif

#if ENABLE_BLE_SCAN
  NimBLEDevice::init("");
#endif

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
  ArduinoOTA.handle();
  checkFactoryReset();
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

  if (millis() - lastReport >= intervalMs) {
    lastReport = millis();
    report();
  }
}
