// ============================================================
//  FULNEX firmware — per-device configuration
//
//  Identity: unique per unit. The serial + claim code go on the
//  label; the key lives only here and in the platform (hashed).
// ============================================================
#pragma once

#define DEVICE_SERIAL    "FLX-0002"
#define DEVICE_KEY       "olof-first-device-key-8c31"
#define CLAIM_CODE       "OLOF01"           // shown on the setup portal
#define MQTT_SECRET      "flx2-9k2m4vq7x"   // instant-command topic secret
#define FIRMWARE_VERSION "1.1.2"

// Platform
#define INGEST_URL "https://esqtrcxaozymslwpeqgu.supabase.co/functions/v1/ingest"
#define CLAIM_BASE "https://fulnex-hub.vercel.app/claim/"

// Instant commands (site -> device in ~1s). Public broker with an
// unguessable per-device topic for the pilot; own broker later.
#define ENABLE_MQTT   1
#define MQTT_HOST     "broker.hivemq.com"
#define MQTT_PORT     1883

// ------------------------------------------------------------
//  Status LED (onboard)
//  Some DevKit clones wire GPIO2's LED active-LOW; if your status
//  LED behaves inverted (on when it should be off), set LOW here.
// ------------------------------------------------------------
#define LED_PIN    2
#define LED_ACTIVE HIGH

// ------------------------------------------------------------
//  SENSES — set a pin to enable, -1 to disable.
//  Port numbers are fixed per sense so dashboards stay stable.
// ------------------------------------------------------------

// DS18B20 temperature probes (any number share this one pin;
// 4.7k pullup to 3V3). Ports 1, 2, 3... by probe index.
#define ONEWIRE_PIN     32

// Analog dial / any 0-3.3V analog signal -> port 4, %
#define POT_PIN         34

// Contact: switch/reed to GND (internal pullup) -> port 5.
// EVENT-DRIVEN: reports the moment it changes.
#define CONTACT_PIN     27

// PIR motion sensor OUT -> port 6. Event-driven.
#define MOTION_PIN      -1    // e.g. 39

// Soil moisture (analog AOUT) -> port 10, %
#define SOIL_PIN        -1    // e.g. 33

// HY-SRF05 / SR04 ultrasonic level -> port 11, cm
// (5V module: divide ECHO down to 3.3V, e.g. 1k/2k)
#define ULTRA_TRIG_PIN  -1    // e.g. 17
#define ULTRA_ECHO_PIN  -1    // e.g. 35

// Mains-present sense -> port 20 (1 = power on). Event-driven.
// Wire USB 5V through a divider (e.g. 10k/15k) to this pin; run
// the board itself from a battery/powerbank to detect outages.
#define VBUS_SENSE_PIN  -1    // e.g. 36

// ------------------------------------------------------------
//  OUTPUTS — controlled from the site
// ------------------------------------------------------------
#define OUT1_PIN        26    // "LED" toggle + brightness slider (PWM)
                              // GPIO25's output driver is dead on this
                              // specific board — confirmed by bench test
#define OUT2_PIN        33    // "Output 2" toggle + Pulse button
#define BUZZER_PIN      -1    // e.g. 13 — site "beep" makes it chirp

// ------------------------------------------------------------
//  ROLE
// ------------------------------------------------------------
// Battery sense role: report once, deep-sleep for the report
// interval, repeat. Weeks on a LiPo. Outputs and event-driven
// senses don't apply while asleep.
#define ENABLE_DEEP_SLEEP 0

// EXPERIMENTAL: BLE scan for Xiaomi ATC climate pucks -> ports
// 30 (temp) / 31 (humidity) / 32 (battery). Needs the
// "NimBLE-Arduino" library. Heavier on memory; test on the bench.
#define ENABLE_BLE_SCAN 0

// v1.1 also includes (always on): NTP time, offline reading
// buffer, cloud OTA, local reflex recipe, factory reset (hold
// BOOT 5s), boot fade, telemetry. TLS pinning lands in v1.2
// after a supervised bench test of the live cert chain.
