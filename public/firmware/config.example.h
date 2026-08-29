// ============================================================
//  Fulnex Hub firmware — per-device configuration (EXAMPLE)
//
//  Rename this file to config.h next to fulnex_hub.ino.
//  DEVICE_SERIAL and DEVICE_KEY are unique per unit — you get
//  yours with your device (never shared publicly).
// ============================================================
#pragma once

#define DEVICE_SERIAL    "FLX-XXXX"
#define DEVICE_KEY       "your-device-key-here"
#define FIRMWARE_VERSION "0.1.0"

// Platform
#define INGEST_URL "https://esqtrcxaozymslwpeqgu.supabase.co/functions/v1/ingest"

// Pins (ESP32 DevKit)
#define LED_PIN      2    // onboard LED
#define ONEWIRE_PIN  32   // DS18B20 data (4.7k pullup to 3V3) — "port 1"

// Optional sensors — set to 1 and wire as noted to enable.
// Soil moisture (analog module, AOUT pin) -> "port 2"
#define ENABLE_SOIL       0
#define SOIL_PIN          33   // AOUT -> GPIO33, VCC -> 3V3, GND -> GND

// HY-SRF05 ultrasonic distance (tank level) -> "port 3", value in cm
#define ENABLE_ULTRASONIC 0
#define ULTRA_TRIG_PIN    25   // TRIG -> GPIO25
#define ULTRA_ECHO_PIN    26   // ECHO -> GPIO26 (5V module: use a divider
                               // 1k/2k to drop ECHO to 3.3V, or run at 3V3)
