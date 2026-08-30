// ============================================================
//  FULNEX SENSE firmware v1.0.0 — one sketch, every sense
//  Board: ESP32-C3 (SuperMini). The whole life of a puck:
//  wake → read → shout one Bluetooth broadcast → sleep.
//
//  Variants (set SENSOR_TYPE below, or provision over serial):
//    1 TEMP    — AHT10/AHT20 on I2C (SDA 8, SCL 9): temp + hum.
//                Wakes every WAKE_S seconds.
//    2 DOOR    — reed switch on WAKE_PIN: broadcasts on every
//                open/close + a heartbeat every HEARTBEAT_S.
//    3 MOTION  — PIR (AM312) on WAKE_PIN: broadcasts on motion
//                + heartbeat.
//    4 LEAK    — probe screws on WAKE_PIN (to GND via water):
//                broadcasts WET immediately + heartbeat.
//
//  The broadcast: BLE manufacturer data, FULNEX frame:
//    [0xFF 0xFF] 'F' 'X' ver(1) type(1) v1_lo v1_hi v2 batt seq
//    v1 = temp*10 (TEMP) or state 0/1 (others), v2 = humidity.
//  TEMP pucks ALSO emit the ATC-compatible 0x181A service frame,
//  so even hubs on fw 2.0 hear them today.
//
//  Serial provisioning (any time in the first 10 s after reset):
//    FULNEX-SENSE type=1 name=FLX-P001
//    FULNEX-INFO
//
//  Power: CR2450/CR2032 straight onto 3V3+GND (the C3 runs fine
//  on 2.6–3.3 V). Deep sleep ~5 µA; a 1.5 s broadcast per minute
//  gives roughly a year on a CR2450.
// ============================================================

#include <NimBLEDevice.h>
#include <Preferences.h>
#include <Wire.h>
#include <esp_sleep.h>

/* ---------- defaults (NVS overrides via provisioning) -------- */
#define SENSOR_TYPE   1        // 1 TEMP · 2 DOOR · 3 MOTION · 4 LEAK
#define WAKE_S        60       // TEMP: seconds between readings
#define HEARTBEAT_S   600      // event types: alive-ping interval
#define ADV_MS        1500     // how long each broadcast lasts
#define WAKE_PIN      3        // reed / PIR / leak probe (RTC-capable)
#define I2C_SDA       8
#define I2C_SCL       9
#define BATT_ADC_PIN  -1       // optional divider; -1 = report 0

Preferences prefs;
uint8_t gType = SENSOR_TYPE;
String gName = "FLX-SENSE";
RTC_DATA_ATTR uint8_t seq = 0;
RTC_DATA_ATTR uint8_t lastState = 255;

/* ---------- AHT10/AHT20 minimal driver ----------------------- */
bool ahtRead(float &t, float &h) {
  Wire.begin(I2C_SDA, I2C_SCL);
  Wire.beginTransmission(0x38);
  Wire.write(0xAC); Wire.write(0x33); Wire.write(0x00);
  if (Wire.endTransmission() != 0) return false;
  delay(85);
  Wire.requestFrom(0x38, 6);
  if (Wire.available() < 6) return false;
  uint8_t d[6];
  for (int i = 0; i < 6; i++) d[i] = Wire.read();
  uint32_t rh = ((uint32_t)d[1] << 12) | ((uint32_t)d[2] << 4) | (d[3] >> 4);
  uint32_t rt = (((uint32_t)d[3] & 0x0F) << 16) | ((uint32_t)d[4] << 8) | d[5];
  h = rh * 100.0f / 1048576.0f;
  t = rt * 200.0f / 1048576.0f - 50.0f;
  return true;
}

uint8_t readBattery() {
#if BATT_ADC_PIN >= 0
  return (uint8_t)constrain((analogReadMilliVolts(BATT_ADC_PIN) * 2 - 2200) / 10, 0, 100);
#else
  return 0;
#endif
}

/* ---------- the broadcast ------------------------------------ */
void advertise(int16_t v1x10, uint8_t v2, uint8_t batt) {
  NimBLEDevice::init(gName.c_str());
  NimBLEAdvertising *adv = NimBLEDevice::getAdvertising();

  // FULNEX frame in manufacturer data
  uint8_t m[11] = { 0xFF, 0xFF, 'F', 'X', 1, gType,
                    (uint8_t)(v1x10 & 0xFF), (uint8_t)(v1x10 >> 8),
                    v2, batt, seq++ };
  NimBLEAdvertisementData ad;
  ad.setFlags(0x06);
  ad.setManufacturerData(std::string((char*)m, sizeof(m)));

  // TEMP also speaks ATC (0x181A) so fw 2.0 hubs hear it already
  if (gType == 1) {
    uint8_t mac[6];
    memcpy(mac, NimBLEDevice::getAddress().getBase()->val, 6);
    uint8_t svc[13];
    for (int i = 0; i < 6; i++) svc[i] = mac[5 - i];
    svc[6] = (uint8_t)(v1x10 >> 8); svc[7] = (uint8_t)(v1x10 & 0xFF);
    svc[8] = v2; svc[9] = batt ? batt : 100;
    svc[10] = 0x0B; svc[11] = 0xB8;          // ~3000 mV
    svc[12] = seq;
    ad.setServiceData(NimBLEUUID((uint16_t)0x181A), std::string((char*)svc, 13));
  }
  adv->setAdvertisementData(ad);
  adv->start();
  delay(ADV_MS);
  adv->stop();
  NimBLEDevice::deinit(true);
}

/* ---------- provisioning window ------------------------------ */
void provisionWindow() {
  unsigned long until = millis() + (esp_reset_reason() == ESP_RST_POWERON ? 10000 : 50);
  while (millis() < until) {
    if (Serial.available()) {
      String line = Serial.readStringUntil('\n');
      line.trim();
      if (line.startsWith("FULNEX-SENSE ")) {
        int ti = line.indexOf("type=");
        int ni = line.indexOf("name=");
        prefs.begin("flxsense", false);
        if (ti >= 0) prefs.putUChar("type", (uint8_t)line.substring(ti + 5).toInt());
        if (ni >= 0) {
          int end = line.indexOf(' ', ni);
          prefs.putString("name", line.substring(ni + 5, end < 0 ? line.length() : end));
        }
        prefs.end();
        Serial.println("[flx-sense] provisioned — restarting");
        delay(200);
        ESP.restart();
      } else if (line == "FULNEX-INFO") {
        Serial.printf("[flx-sense] name=%s type=%d fw=1.0.0\n", gName.c_str(), gType);
      }
    }
    delay(20);
  }
}

/* ------------------------------------------------------------- */
void setup() {
  Serial.begin(115200);
  prefs.begin("flxsense", true);
  gType = prefs.getUChar("type", SENSOR_TYPE);
  gName = prefs.getString("name", "FLX-SENSE");
  prefs.end();
  provisionWindow();

  bool eventWake = esp_sleep_get_wakeup_cause() == ESP_SLEEP_WAKEUP_GPIO;

  if (gType == 1) {
    float t = 0, h = 0;
    bool ok = ahtRead(t, h);
    advertise(ok ? (int16_t)(t * 10) : -1000, ok ? (uint8_t)(h + 0.5f) : 0, readBattery());
    esp_sleep_enable_timer_wakeup((uint64_t)WAKE_S * 1000000ULL);
  } else {
    pinMode(WAKE_PIN, INPUT_PULLUP);
    delay(15);
    uint8_t state = digitalRead(WAKE_PIN) == LOW ? 1 : 0;  // active = LOW
    // broadcast on every event wake, on state change, and heartbeat
    if (eventWake || state != lastState ||
        esp_sleep_get_wakeup_cause() != ESP_SLEEP_WAKEUP_GPIO) {
      advertise((int16_t)state * 10, 0, readBattery());
      lastState = state;
    }
    // wake when the line flips (whichever way it currently isn't)
    esp_deep_sleep_enable_gpio_wakeup(1ULL << WAKE_PIN,
      state ? ESP_GPIO_WAKEUP_GPIO_HIGH : ESP_GPIO_WAKEUP_GPIO_LOW);
    esp_sleep_enable_timer_wakeup((uint64_t)HEARTBEAT_S * 1000000ULL);
  }

  Serial.printf("[flx-sense] %s type=%d — sleeping\n", gName.c_str(), gType);
  Serial.flush();
  esp_deep_sleep_start();
}

void loop() {}
