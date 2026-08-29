// ============================================================
//  FULNEX config — FLX-0004 "BILTONG KAS" (Olof)
//  Copy this file over firmware/fulnex_hub/config.h to build.
//
//  Wiring (from Olof's original controller):
//    GPIO5  DHT22            -> ports 8 (°C) + 9 (%RH)
//    GPIO4  door reed switch -> port 5 (event-driven)
//    GPIO22 relay: LED lights        (active LOW) -> "LED" toggle
//    GPIO21 relay: bottom intake fans (active LOW) -> "Output 2"
//    GPIO19 relay: top exhaust fans   (active LOW) -> "Output 3"
// ============================================================
#pragma once

#define DEVICE_SERIAL    "FLX-0004"
#define DEVICE_KEY       "biltong-key-m4q8z2"
#define CLAIM_CODE       "BILT01"
#define MQTT_SECRET      "flx4-bilt-h6v9s"
#define FIRMWARE_VERSION "1.2.1"

// Platform
#define INGEST_URL "https://esqtrcxaozymslwpeqgu.supabase.co/functions/v1/ingest"
#define CLAIM_BASE "https://fulnex-hub.vercel.app/claim/"

#define ENABLE_MQTT   1
#define MQTT_HOST     "broker.hivemq.com"
#define MQTT_PORT     1883

// Status LED (onboard)
#define LED_PIN    2
#define LED_ACTIVE HIGH

// ---- senses ----
#define ONEWIRE_PIN     -1
#define POT_PIN         -1
#define CONTACT_PIN     4     // door reed, INPUT_PULLUP — event-driven
#define MOTION_PIN      -1
#define DHT_PIN         5     // DHT22 -> ports 8 + 9
#define SOIL_PIN        -1
#define SOIL2_PIN       -1
#define ULTRA_TRIG_PIN  -1
#define ULTRA_ECHO_PIN  -1
#define VBUS_SENSE_PIN  -1

// ---- outputs: three active-LOW relays ----
#define OUT1_PIN        22    // LED lights ("LED" toggle on the site)
#define OUT1_ACTIVE     LOW
#define OUT1_PWM        0     // relay — plain on/off, never PWM

#define OUT2_PIN        21    // bottom intake fans ("Output 2")
#define OUT2_ACTIVE     LOW

#define OUT3_PIN        19    // top exhaust fans ("Output 3")
#define OUT3_ACTIVE     LOW

#define BUZZER_PIN      -1

// ---- role ----
#define ENABLE_DEEP_SLEEP 0
#define ENABLE_BLE_SCAN   0
