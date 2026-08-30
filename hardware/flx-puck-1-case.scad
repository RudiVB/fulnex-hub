// ============================================================
//  FLX-PUCK-1 — the Bluetooth sense puck (Rev A)
//  FULNEX · matte black PETG · the flattened dome from the
//  renders: Ø46 soft disc, LED dot centre-top, nothing else.
//
//  Inside: ESP32-C3 SuperMini (BLE 5 beacon, deep-sleep),
//  CR2450 coin cell in a holder, one sensor module (temp/hum,
//  reed, PIR — same shell for every puck variant).
//
//  Two parts:
//   - shell: the dome. Print TOP-FACE-DOWN on a textured plate —
//     the rounded edge then prints support-free and the face is
//     flawless.
//   - base:  flat plate that screws up into the shell (2× M2,
//     from below). Carries the cell pocket, the C3 pillar rails
//     above the cell, vent slots, a keyhole + tape zone.
//
//  Assembly: cell holder into its pocket · C3 board into the
//  pillar slots · sensor beside the vents · wire · base up into
//  the shell, 2 screws · sticker or screw it anywhere.
// ============================================================

part = "both";        // "shell" | "base" | "both"
// what this puck does, in small letters under the dot
variant1 = "TEMP · HUMIDITY";
variant2 = "";
// MOTION variant: set lens_d = 13 and variant1 = "MOTION" — the
// PIR's fresnel dome pokes through the centre, the LED dot moves
// to the shoulder, and an interior ring grips the AM312 lens.
lens_d = 0;

/* ---------- master dimensions ---------- */
PR = 23;              // puck radius (Ø46)
PH = 17;              // height
PE = 6;               // edge roundover — the softness
WALL = 2.2;
TOP = 2.0;

pipe_d = 1.6;         // LED dot, dead centre

/* ---------- base plate ---------- */
BASE_T = 1.8;
BASE_R = PR - WALL - 0.25;    // slips inside the shell
cell_d = 29.4;                // CR2450 holder pocket
cell_wall = 1.2;
boss_r = PR - WALL - 3.2;     // shell screw bosses, on Y axis

$fn = 96;

/* ============ helpers ============ */
// solid of revolution: disc with rounded outer edge
module puck_solid(r, h, re) {
  rotate_extrude()
    intersection() {
      offset(re) translate([0, 0]) square([r - re, h - re]);
      square([r, h]);
    }
}

/* ============ SHELL ============ */
module shell() {
  difference() {
    puck_solid(PR, PH, PE);
    // cavity — open bottom, TOP mm ceiling, WALL mm walls
    translate([0, 0, -0.1]) puck_solid(PR - WALL, PH - TOP + 0.1, 4);
    // LED light pipe: dead centre, or on the shoulder when the
    // PIR lens owns the middle
    if (lens_d > 0) {
      translate([0, 0, -1]) cylinder(d = lens_d, h = PH + 2);
      translate([8.5, 8.5, PH - 3]) cylinder(d = pipe_d, h = 5);
    } else {
      translate([0, 0, -1]) cylinder(d = pipe_d, h = PH + 2);
    }
    // identity, debossed into the face: FULNEX above the dot,
    // what-it-is below (prints crisp — face-down on the plate)
    translate([0, lens_d > 0 ? 10.5 : 7.5, PH - 0.6])
      linear_extrude(0.7)
        text("FULNEX", size = lens_d > 0 ? 3.2 : 3.8, font = "Arial:style=Bold",
             halign = "center", valign = "center", spacing = 1.35);
    translate([0, lens_d > 0 ? -10.5 : (variant2 == "" ? -8 : -6.5), PH - 0.6])
      linear_extrude(0.7)
        text(variant1, size = 2.2, font = "Arial:style=Bold",
             halign = "center", valign = "center", spacing = 1.4);
    if (variant2 != "")
      translate([0, -11, PH - 0.6])
        linear_extrude(0.7)
          text(variant2, size = 2.2, font = "Arial:style=Bold",
               halign = "center", valign = "center", spacing = 1.4);
    // micro vent ring hidden under the rim (sensor breathes)
    for (a = [0 : 45 : 359])
      rotate([0, 0, a])
        translate([PR - WALL/2 - 1, 0, -0.1])
          cylinder(d = 2.2, h = 2.5);
  }
  // screw bosses for the base, either side on Y
  for (s = [-1, 1])
    translate([0, s * boss_r, 0])
      difference() {
        cylinder(d = 6.5, h = PH - TOP - 0.4);
        translate([0, 0, 2]) cylinder(d = 1.7, h = PH);   // M2 self-tap
      }
  // MOTION: retention ring under the ceiling grips the AM312 lens
  if (lens_d > 0)
    translate([0, 0, PH - TOP - 4])
      difference() {
        cylinder(d = lens_d + 3.6, h = 4);
        translate([0, 0, -0.1]) cylinder(d = lens_d - 0.6, h = 4.2);
      }
}

/* ============ BASE ============ */
module base() {
  difference() {
    cylinder(r = BASE_R, h = BASE_T);
    // shell screws pass through, countersunk from below
    for (s = [-1, 1]) {
      translate([0, s * boss_r, -0.1]) cylinder(d = 2.4, h = BASE_T + 1);
      translate([0, s * boss_r, -0.01]) cylinder(d1 = 4.6, d2 = 2.4, h = 1.2);
    }
    // keyhole: hang the puck on one screw
    translate([-9, 0, -0.1]) cylinder(d = 7, h = BASE_T + 1);
    hull() {
      translate([-9, 0, -0.1]) cylinder(d = 3.4, h = BASE_T + 1);
      translate([-14, 0, -0.1]) cylinder(d = 3.4, h = BASE_T + 1);
    }
    // vent slots over the sensor zone (right side)
    for (i = [-1, 0, 1])
      translate([11, i * 5 - 1, -0.1]) cube([8, 2, BASE_T + 1]);
  }
  // CR2450 holder pocket, centre — a low retaining ring
  difference() {
    cylinder(d = cell_d + 2 * cell_wall, h = BASE_T + 2.2);
    translate([0, 0, BASE_T]) cylinder(d = cell_d, h = 4);
    translate([0, 0, -0.1]) cylinder(d = cell_d - 6, h = BASE_T + 3); // wire access
    // don't swallow the keyhole
    translate([-16, -4, -0.1]) cube([8, 8, BASE_T + 3]);
  }
  // C3 pillar rails: the SuperMini (18 mm wide) slots in ABOVE
  // the cell — two pillars each side with a 2 mm groove at height
  for (s = [-1, 1])
    for (x = [-8, 6])
      translate([x, s * 10.6, 0])
        difference() {
          cube([5, 3, 11]);
          translate([-0.5, s < 0 ? 1.6 : -0.6, 8.4]) cube([6, 2, 2]);
        }
}

/* ============ layout ============ */
if (part == "shell" || part == "both") shell();
if (part == "base")
  base();
if (part == "both")
  translate([PR * 2 + 14, 0, 0]) base();
