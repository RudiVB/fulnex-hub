// ============================================================
//  FULNEX firmware v1.0
//
//  One firmware for every Fulnex hub. Enable senses and outputs
//  in config.h; the platform discovers them by their ports.
//
//  SENSES (fixed ports)
//   1..3  DS18B20 temperature probes     (ONEWIRE_PIN)
//   4     analog dial / 0-3.3V signal, % (POT_PIN)
//   5     contact open/closed            (CONTACT_PIN, event-driven)
//   6     motion                         (MOTION_PIN, event-driven)
//   10    soil moisture, %               (SOIL_PIN)
//   11    ultrasonic level, cm           (ULTRA_TRIG/ECHO_PIN)
//   20    mains power present            (VBUS_SENSE_PIN, event-driven)
//
//  CONTROLS (from the site, in the ingest reply)
//   led + brightness  -> OUT1_PIN (PWM)
//   led2              -> OUT2_PIN
//   pulse_id/pulse_ms -> OUT2_PIN momentary (gate pattern)
//   beep_id           -> BUZZER_PIN chirps (active buzzer)
//   interval          -> report cadence (10..3600 s)
//
//  EVENT-DRIVEN: contact / motion / power changes report within
//  ~2 seconds, not on the next minute.
//
//  Setup portal: FULNEX-branded dark captive portal.
//  Libraries: WiFiManager (tzapu), OneWire, DallasTemperature.
//  Board: ESP32 Dev Module.
// ============================================================

#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>
#include <WiFiManager.h>
#include <ArduinoOTA.h>
#include <OneWire.h>
#include <DallasTemperature.h>
#include "config.h"

#if ONEWIRE_PIN >= 0
OneWire oneWire(ONEWIRE_PIN);
DallasTemperature probes(&oneWire);
#endif

unsigned long lastReport = 0;
unsigned long intervalMs = 60000;
int failures = 0;
bool unauthorized = false;
long lastPulseId = -1;
long lastBeepId = -1;

// last values the server knows, for event detection (-999 = never sent)
int sentContact = -999;
int sentMotion = -999;
int sentPower = -999;
unsigned long lastEventMs = 0;

// ------------------------------------------------------------
//  FULNEX-branded captive portal
// ------------------------------------------------------------
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
  "<div style='text-align:center;margin:18px 0 2px;font-size:11px;"
  "letter-spacing:.35em;color:#5e6165'>YOUR THINGS, WATCHED</div>";

// ------------------------------------------------------------
//  helpers
// ------------------------------------------------------------
long numFromBody(const String& body, const char* key, long fallback) {
  int i = body.indexOf(key);
  if (i < 0) return fallback;
  return body.substring(i + strlen(key)).toInt();
}

void setOut1Duty(int pct) {
  if (pct < 0) pct = 0;
  if (pct > 100) pct = 100;
#if defined(ESP_ARDUINO_VERSION_MAJOR) && ESP_ARDUINO_VERSION_MAJOR >= 3
  ledcWrite(OUT1_PIN, pct * 255 / 100);
#else
  ledcWrite(0, pct * 255 / 100);
#endif
}

// status LED, polarity-independent. ledBase = the steady state the
// LED returns to after any flash pattern (true = online).
bool ledBase = false;

void setStatusLed(bool on) {
  digitalWrite(LED_PIN, on ? LED_ACTIVE : !LED_ACTIVE);
}

void flashLed(int times, int onMs, int offMs) {
  for (int i = 0; i < times; i++) {
    setStatusLed(false);
    delay(offMs);
    setStatusLed(true);
    delay(onMs);
  }
  setStatusLed(ledBase);
}

void beep(int times) {
#if BUZZER_PIN >= 0
  for (int i = 0; i < times; i++) {
    digitalWrite(BUZZER_PIN, HIGH);
    delay(90);
    digitalWrite(BUZZER_PIN, LOW);
    delay(90);
  }
#endif
}

void addReading(String& json, bool& first, int port, const String& value, const char* kind) {
  if (!first) json += ",";
  json += "{\"port\":" + String(port) + ",\"value\":" + value +
          ",\"kind\":\"" + kind + "\"}";
  first = false;
}

// ------------------------------------------------------------
//  senses -> JSON
// ------------------------------------------------------------
String buildPayload() {
  String json = "{\"serial\":\"" DEVICE_SERIAL "\",\"key\":\"" DEVICE_KEY
                "\",\"fw\":\"" FIRMWARE_VERSION "\",\"rssi\":";
  json += String(WiFi.RSSI());
  json += ",\"readings\":[";
  bool first = true;

#if ONEWIRE_PIN >= 0
  probes.requestTemperatures();
  int n = probes.getDeviceCount();
  if (n > 3) n = 3;
  for (int i = 0; i < n; i++) {
    float t = probes.getTempCByIndex(i);
    if (t > -100 && t < 125) addReading(json, first, 1 + i, String(t, 2), "temp");
  }
#endif

#if POT_PIN >= 0
  {
    long sum = 0;
    for (int i = 0; i < 8; i++) { sum += analogRead(POT_PIN); delay(2); }
    float pct = (sum / 8.0f) * 100.0f / 4095.0f;
    addReading(json, first, 4, String(pct, 1), "analog");
  }
#endif

#if CONTACT_PIN >= 0
  {
    int closed = digitalRead(CONTACT_PIN) == LOW ? 1 : 0;
    addReading(json, first, 5, String(closed), "contact");
    sentContact = closed;
  }
#endif

#if MOTION_PIN >= 0
  {
    int m = digitalRead(MOTION_PIN) == HIGH ? 1 : 0;
    addReading(json, first, 6, String(m), "motion");
    sentMotion = m;
  }
#endif

#if SOIL_PIN >= 0
  {
    long sum = 0;
    for (int i = 0; i < 8; i++) { sum += analogRead(SOIL_PIN); delay(2); }
    float pct = 100.0f - (sum / 8.0f) * 100.0f / 4095.0f;
    addReading(json, first, 10, String(pct, 1), "moisture");
  }
#endif

#if ULTRA_TRIG_PIN >= 0 && ULTRA_ECHO_PIN >= 0
  {
    digitalWrite(ULTRA_TRIG_PIN, LOW);
    delayMicroseconds(4);
    digitalWrite(ULTRA_TRIG_PIN, HIGH);
    delayMicroseconds(10);
    digitalWrite(ULTRA_TRIG_PIN, LOW);
    unsigned long us = pulseIn(ULTRA_ECHO_PIN, HIGH, 30000);
    if (us > 0) addReading(json, first, 11, String(us / 58.0f, 1), "level");
  }
#endif

#if VBUS_SENSE_PIN >= 0
  {
    int p = analogRead(VBUS_SENSE_PIN) > 1000 ? 1 : 0;
    addReading(json, first, 20, String(p), "contact");
    sentPower = p;
  }
#endif

  json += "]}";
  return json;
}

// ------------------------------------------------------------
//  report + apply controls from the reply
// ------------------------------------------------------------
void report() {
  if (WiFi.status() != WL_CONNECTED) return;

  WiFiClientSecure client;
  client.setInsecure();  // TLS without pinning in v1.0; pinned later
  HTTPClient http;
  http.setTimeout(10000);
  if (!http.begin(client, INGEST_URL)) return;
  http.addHeader("Content-Type", "application/json");

  int status = http.POST(buildPayload());
  String body = http.getString();
  http.end();

  Serial.printf("[fulnex] report -> %d %s\n", status, body.c_str());

  if (status == 200) {
    failures = 0;
    unauthorized = false;
    flashLed(2, 60, 60);

    long secs = numFromBody(body, "\"interval\":", 60);
    if (secs >= 10 && secs <= 3600) intervalMs = secs * 1000UL;

    bool ledOn = body.indexOf("\"led\":true") >= 0;
    long bri = numFromBody(body, "\"brightness\":", 100);
    setOut1Duty(ledOn ? (int)bri : 0);

#if OUT2_PIN >= 0
    if (body.indexOf("\"led2\":true") >= 0)  digitalWrite(OUT2_PIN, HIGH);
    if (body.indexOf("\"led2\":false") >= 0) digitalWrite(OUT2_PIN, LOW);

    long pid = numFromBody(body, "\"pulse_id\":", -1);
    if (pid >= 0) {
      if (lastPulseId < 0) {
        lastPulseId = pid;  // sync on boot, never replay
      } else if (pid > lastPulseId) {
        long ms = numFromBody(body, "\"pulse_ms\":", 500);
        if (ms < 50) ms = 50;
        if (ms > 2000) ms = 2000;
        digitalWrite(OUT2_PIN, HIGH);
        delay(ms);
        digitalWrite(OUT2_PIN, LOW);
        lastPulseId = pid;
        Serial.printf("[fulnex] pulse %ldms (id %ld)\n", ms, pid);
      }
    }
#endif

    long bid = numFromBody(body, "\"beep_id\":", -1);
    if (bid >= 0) {
      if (lastBeepId < 0) lastBeepId = bid;
      else if (bid > lastBeepId) { beep(3); lastBeepId = bid; }
    }
  } else if (status == 401) {
    unauthorized = true;
  } else {
    failures++;
    if (failures >= 10) {
      Serial.println("[fulnex] too many failures, rebooting");
      ESP.restart();
    }
  }
}

// events: report changed contacts/motion/power within ~2 s
void checkEvents() {
  bool changed = false;
#if CONTACT_PIN >= 0
  if (sentContact != -999 &&
      (digitalRead(CONTACT_PIN) == LOW ? 1 : 0) != sentContact) changed = true;
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

// ------------------------------------------------------------
void setup() {
  Serial.begin(115200);
  pinMode(LED_PIN, OUTPUT);
  setStatusLed(false);              // off = not yet online

#if ONEWIRE_PIN >= 0
  probes.begin();
  Serial.printf("[fulnex] %s fw %s, %d probe(s)\n",
                DEVICE_SERIAL, FIRMWARE_VERSION, probes.getDeviceCount());
#else
  Serial.printf("[fulnex] %s fw %s\n", DEVICE_SERIAL, FIRMWARE_VERSION);
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
  pinMode(OUT2_PIN, OUTPUT);
  digitalWrite(OUT2_PIN, LOW);
#endif
#if BUZZER_PIN >= 0
  pinMode(BUZZER_PIN, OUTPUT);
  digitalWrite(BUZZER_PIN, LOW);
#endif
#if defined(ESP_ARDUINO_VERSION_MAJOR) && ESP_ARDUINO_VERSION_MAJOR >= 3
  ledcAttach(OUT1_PIN, 5000, 8);
#else
  ledcSetup(0, 5000, 8);
  ledcAttachPin(OUT1_PIN, 0);
#endif
  setOut1Duty(0);

  // FULNEX-branded setup portal
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

  ArduinoOTA.setHostname(ap.c_str());
  ArduinoOTA.begin();

  ledBase = true;                   // solid = online
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

  if (unauthorized) {
    flashLed(1, 80, 80);
    delay(200);
  }

  if (WiFi.status() != WL_CONNECTED) {
    ledBase = false;
    setStatusLed(false);            // dark = offline/reconnecting
    delay(500);
    return;
  }
  ledBase = true;
  setStatusLed(true);               // solid = online

  checkEvents();

  if (millis() - lastReport >= intervalMs) {
    lastReport = millis();
    report();
  }
}
