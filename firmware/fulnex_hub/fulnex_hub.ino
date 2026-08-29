// ============================================================
//  Fulnex Hub — firmware v0.1
//
//  What it does:
//   - First boot (or unknown Wi-Fi): opens a hotspot named
//     FULNEX-<serial>. Join it with a phone; a setup page pops
//     up; pick your home Wi-Fi. After that it connects itself,
//     forever.
//   - Reads DS18B20 temperature probe(s) on ONEWIRE_PIN (port 1).
//   - Reports to the Fulnex platform every 60 s (server can tune
//     the interval in its reply).
//   - LED: solid = online, short flash = report sent,
//     fast blink = unauthorized (wrong key/serial).
//   - ArduinoOTA: reflash over the local network from Arduino IDE
//     (device shows up as network port "FULNEX-<serial>").
//   - Self-heals: Wi-Fi drops reconnect automatically; 10 failed
//     reports in a row = reboot.
//
//  Libraries (Arduino IDE -> Library Manager):
//   - WiFiManager by tzapu
//   - OneWire
//   - DallasTemperature
//  Board: "ESP32 Dev Module"
// ============================================================

#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>
#include <WiFiManager.h>
#include <ArduinoOTA.h>
#include <OneWire.h>
#include <DallasTemperature.h>
#include "config.h"

OneWire oneWire(ONEWIRE_PIN);
DallasTemperature probes(&oneWire);

unsigned long lastReport = 0;
unsigned long intervalMs = 60000;
int failures = 0;
bool unauthorized = false;
long lastPulseId = -1;

// find "key":<number> in the reply; returns fallback if absent
long numFromBody(const String& body, const char* key, long fallback) {
  int i = body.indexOf(key);
  if (i < 0) return fallback;
  return body.substring(i + strlen(key)).toInt();
}

void setLedDuty(int pct) {
#if ENABLE_TEST_BENCH
  if (pct < 0) pct = 0;
  if (pct > 100) pct = 100;
#if defined(ESP_ARDUINO_VERSION_MAJOR) && ESP_ARDUINO_VERSION_MAJOR >= 3
  ledcWrite(EXT_LED_PIN, pct * 255 / 100);
#else
  ledcWrite(0, pct * 255 / 100);
#endif
#endif
}

void flashLed(int times, int onMs, int offMs) {
  for (int i = 0; i < times; i++) {
    digitalWrite(LED_PIN, LOW);
    delay(offMs);
    digitalWrite(LED_PIN, HIGH);
    delay(onMs);
  }
}

String buildPayload() {
  String json = "{\"serial\":\"" DEVICE_SERIAL "\",\"key\":\"" DEVICE_KEY
                "\",\"fw\":\"" FIRMWARE_VERSION "\",\"rssi\":";
  json += String(WiFi.RSSI());
  json += ",\"readings\":[";

  probes.requestTemperatures();
  int n = probes.getDeviceCount();
  bool first = true;
  for (int i = 0; i < n; i++) {
    float t = probes.getTempCByIndex(i);
    if (t <= -100 || t >= 125) continue;  // disconnected/garbage
    if (!first) json += ",";
    json += "{\"port\":" + String(i + 1) +
            ",\"value\":" + String(t, 2) +
            ",\"kind\":\"temp\"}";
    first = false;
  }

#if ENABLE_SOIL
  {
    // average a few samples; report as 0-100 "wetness" (raw ADC inverted)
    long sum = 0;
    for (int i = 0; i < 8; i++) { sum += analogRead(SOIL_PIN); delay(5); }
    float pct = 100.0f - (sum / 8.0f) * 100.0f / 4095.0f;
    if (!first) json += ",";
    json += "{\"port\":2,\"value\":" + String(pct, 1) + ",\"kind\":\"moisture\"}";
    first = false;
  }
#endif

#if ENABLE_TEST_BENCH
  {
    long sum = 0;
    for (int i = 0; i < 4; i++) { sum += analogRead(POT_PIN); delay(2); }
    float pct = (sum / 4.0f) * 100.0f / 4095.0f;
    if (!first) json += ",";
    json += "{\"port\":4,\"value\":" + String(pct, 1) + ",\"kind\":\"analog\"}";
    json += ",{\"port\":5,\"value\":" +
            String(digitalRead(SWITCH_PIN) == LOW ? 1 : 0) +
            ",\"kind\":\"contact\"}";
    first = false;
  }
#endif

#if ENABLE_ULTRASONIC
  {
    pinMode(ULTRA_TRIG_PIN, OUTPUT);
    pinMode(ULTRA_ECHO_PIN, INPUT);
    digitalWrite(ULTRA_TRIG_PIN, LOW);
    delayMicroseconds(4);
    digitalWrite(ULTRA_TRIG_PIN, HIGH);
    delayMicroseconds(10);
    digitalWrite(ULTRA_TRIG_PIN, LOW);
    unsigned long us = pulseIn(ULTRA_ECHO_PIN, HIGH, 30000);  // 30 ms ~ 5 m
    if (us > 0) {
      float cm = us / 58.0f;  // distance to surface, in cm
      if (!first) json += ",";
      json += "{\"port\":3,\"value\":" + String(cm, 1) + ",\"kind\":\"level\"}";
      first = false;
    }
  }
#endif

  json += "]}";
  return json;
}

void report() {
  if (WiFi.status() != WL_CONNECTED) return;

  WiFiClientSecure client;
  client.setInsecure();  // v0.1: TLS without cert pinning; pinned in v0.2
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
    flashLed(2, 60, 60);  // the "I spoke to the cloud" wink

    // honor the server-tuned interval: {"interval":60}
    int idx = body.indexOf("\"interval\":");
    if (idx >= 0) {
      long secs = body.substring(idx + 11).toInt();
      if (secs >= 10 && secs <= 3600) intervalMs = secs * 1000UL;
    }

#if ENABLE_TEST_BENCH
    // remote controls, carried in the reply:
    // led on/off + brightness (PWM), output 2 toggle, momentary pulse
    bool ledOn = body.indexOf("\"led\":true") >= 0;
    long bri = numFromBody(body, "\"brightness\":", 100);
    setLedDuty(ledOn ? (int)bri : 0);

    if (body.indexOf("\"led2\":true") >= 0)  digitalWrite(OUT2_PIN, HIGH);
    if (body.indexOf("\"led2\":false") >= 0) digitalWrite(OUT2_PIN, LOW);

    long pid = numFromBody(body, "\"pulse_id\":", -1);
    if (pid >= 0) {
      if (lastPulseId < 0) {
        lastPulseId = pid;            // sync on boot, don't replay old pulses
      } else if (pid > lastPulseId) {
        long ms = numFromBody(body, "\"pulse_ms\":", 500);
        if (ms < 50) ms = 50;
        if (ms > 2000) ms = 2000;
        digitalWrite(OUT2_PIN, HIGH);
        delay(ms);
        digitalWrite(OUT2_PIN, LOW);
        lastPulseId = pid;
        Serial.printf("[fulnex] pulse %ldms fired (id %ld)\n", ms, pid);
      }
    }
#endif
  } else if (status == 401) {
    unauthorized = true;  // wrong serial/key — fast blink, no reboot spiral
  } else {
    failures++;
    if (failures >= 10) {
      Serial.println("[fulnex] too many failures, rebooting");
      ESP.restart();
    }
  }
}

void setup() {
  Serial.begin(115200);
  pinMode(LED_PIN, OUTPUT);
  digitalWrite(LED_PIN, LOW);

  probes.begin();
  Serial.printf("[fulnex] %s fw %s, %d probe(s) found\n",
                DEVICE_SERIAL, FIRMWARE_VERSION, probes.getDeviceCount());

#if ENABLE_TEST_BENCH
  pinMode(SWITCH_PIN, INPUT_PULLUP);
  pinMode(OUT2_PIN, OUTPUT);
  digitalWrite(OUT2_PIN, LOW);
#if defined(ESP_ARDUINO_VERSION_MAJOR) && ESP_ARDUINO_VERSION_MAJOR >= 3
  ledcAttach(EXT_LED_PIN, 5000, 8);      // PWM for the brightness slider
#else
  ledcSetup(0, 5000, 8);
  ledcAttachPin(EXT_LED_PIN, 0);
#endif
  setLedDuty(0);
#endif

  // Wi-Fi: connects with saved credentials, or opens the setup portal
  WiFiManager wm;
  wm.setConfigPortalTimeout(300);          // 5 min portal, then retry boot
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

  digitalWrite(LED_PIN, HIGH);             // solid = online
  report();                                // first report immediately
  lastReport = millis();
}

void loop() {
  ArduinoOTA.handle();

  if (unauthorized) {
    flashLed(1, 80, 80);                   // continuous fast blink
    delay(200);
  }

  if (WiFi.status() != WL_CONNECTED) {
    digitalWrite(LED_PIN, LOW);            // dark = offline, reconnecting
    delay(500);
    return;
  }
  digitalWrite(LED_PIN, HIGH);

  if (millis() - lastReport >= intervalMs) {
    lastReport = millis();
    report();
  }
}
