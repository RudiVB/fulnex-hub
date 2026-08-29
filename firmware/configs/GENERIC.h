// ============================================================
//  FULNEX config — GENERIC (the one true build)
//  Copy over firmware/fulnex_hub/config.h for every 2.x build.
//
//  This build carries NO identity: flash it, then provision over
//  USB serial with the line the Admin mint card gives you:
//    FULNEX-PROVISION serial=FLX-0007 key=... claim=... mqtt=...
//  Port map defaults below match the FLX-HUB-1 Rev A carrier;
//  override per-unit with FULNEX-PM or cloud desired.pm.
// ============================================================
#pragma once

#define DEVICE_SERIAL    "FLX-0000"
#define DEVICE_KEY       ""
#define CLAIM_CODE       ""
#define MQTT_SECRET      ""
#define FIRMWARE_VERSION "set-by-ino"

// Platform
#define INGEST_URL "https://esqtrcxaozymslwpeqgu.supabase.co/functions/v1/ingest"
#define CLAIM_BASE "https://fulnex-hub.vercel.app/claim/"

#define ENABLE_MQTT   1
#define MQTT_HOST     "broker.hivemq.com"
#define MQTT_PORT     1883

// Status LED (onboard)
#define LED_PIN    2
#define LED_ACTIVE HIGH

// ---- senses: FLX-HUB-1 Rev A defaults ----
#define ONEWIRE_PIN     32    // P1 temp bus
#define POT_PIN         -1    // P11 analog (GPIO34) — enable per install
#define CONTACT_PIN     -1
#define MOTION_PIN      -1
#define DHT_PIN         -1
#define SOIL_PIN        -1
#define SOIL2_PIN       -1
#define ULTRA_TRIG_PIN  -1    // P10 = GPIO16/17 when used
#define ULTRA_ECHO_PIN  -1
#define VBUS_SENSE_PIN  -1    // P12 = GPIO35 when used

// ---- outputs: Rev A relays, active LOW ----
#define OUT1_PIN        23
#define OUT1_ACTIVE     LOW
#define OUT1_PWM        0

#define OUT2_PIN        18
#define OUT2_ACTIVE     LOW

#define OUT3_PIN        19
#define OUT3_ACTIVE     LOW

#define BUZZER_PIN      -1

// ---- role ----
#define ENABLE_DEEP_SLEEP 0
#define ENABLE_BLE_SCAN   0
