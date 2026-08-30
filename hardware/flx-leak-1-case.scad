// ============================================================
//  FLX-LEAK-1 — the floor water sensor (Rev A)
//  FULNEX · matte black PETG · a low soft disc that stands on
//  its own probes: two stainless M3 screw heads under the base
//  ARE the electrodes — water bridges them, the C3 wakes and
//  shouts. A third printed foot keeps it level.
//
//  Face: FULNEX · dot · LEAK. Shell prints face-down.
//  Inside: ESP32-C3 SuperMini + bare CR2032 in a pocket ring.
//  Wires: one to each probe screw (ring terminals under the
//  screw heads inside), GPIO senses the bridge.
//
//  Lives under geysers, washing machines, sinks, aquariums.
// ============================================================

part = "both";        // "shell" | "base" | "both"

/* ---------- dimensions ---------- */
LR = 20;              // radius (Ø40)
LH = 13;              // height
LE = 5;               // edge roundover
WALL = 2.0;
TOP = 1.8;

pipe_d = 1.6;
BASE_T = 1.8;
BASE_R = LR - WALL - 0.25;
boss_r = LR - WALL - 3.0;    // shell screw bosses on Y

probe_x = 10;                // the two probe screws, on X
foot_r = 15;                 // printed third foot position (rear)

$fn = 96;

module leak_solid(r, h, re) {
  rotate_extrude()
    intersection() {
      offset(re) square([r - re, h - re]);
      square([r, h]);
    }
}

/* ============ SHELL ============ */
module shell() {
  difference() {
    leak_solid(LR, LH, LE);
    translate([0, 0, -0.1]) leak_solid(LR - WALL, LH - TOP + 0.1, 3);
    // LED dot, centre
    translate([0, 0, -1]) cylinder(d = pipe_d, h = LH + 2);
    // identity
    translate([0, 6.5, LH - 0.6])
      linear_extrude(0.7)
        text("FULNEX", size = 3.2, font = "Arial:style=Bold",
             halign = "center", valign = "center", spacing = 1.3);
    translate([0, -7, LH - 0.6])
      linear_extrude(0.7)
        text("LEAK", size = 2.8, font = "Arial:style=Bold",
             halign = "center", valign = "center", spacing = 1.5);
  }
  // screw bosses for the base
  for (s = [-1, 1])
    translate([0, s * boss_r, 0])
      difference() {
        cylinder(d = 6, h = LH - TOP - 0.4);
        translate([0, 0, 2]) cylinder(d = 1.7, h = LH);
      }
}

/* ============ BASE ============ */
module base() {
  difference() {
    cylinder(r = BASE_R, h = BASE_T);
    // shell screws, countersunk from below
    for (s = [-1, 1]) {
      translate([0, s * boss_r, -0.1]) cylinder(d = 2.4, h = BASE_T + 1);
      translate([0, s * boss_r, -0.01]) cylinder(d1 = 4.6, d2 = 2.4, h = 1.2);
    }
    // the two probe screws: M3 through-holes; the heads stand
    // 1.5 mm proud underneath as the water electrodes
    for (s = [-1, 1])
      translate([s * probe_x, 0, -0.1]) cylinder(d = 3.2, h = BASE_T + 1);
  }
  // probe screw bosses inside (nut + ring terminal land here)
  for (s = [-1, 1])
    translate([s * probe_x, 0, BASE_T])
      difference() {
        cylinder(d = 8, h = 2.4);
        translate([0, 0, -0.1]) cylinder(d = 3.2, h = 3);
      }
  // third foot: printed stub matching the probe-head height, rear
  translate([0, foot_r, 0])
    rotate([180, 0, 0]) cylinder(d = 5, h = 1.5);
  // CR2032 pocket ring, offset forward
  translate([0, -6, 0])
    difference() {
      cylinder(d = 21.6 + 2.4, h = BASE_T + 2);
      translate([0, 0, BASE_T]) cylinder(d = 20.6, h = 4);
      translate([0, 0, -0.1]) cylinder(d = 14, h = BASE_T + 3);
    }
  // C3 board corner stops (board stands on edge is too tall —
  // it lies flat across the rear chord, resting on these)
  for (x = [-11, 9])
    translate([x, 8, 0]) cube([2, 6, 3]);
}

/* ============ layout ============ */
if (part == "shell" || part == "both") shell();
if (part == "base") base();
if (part == "both") translate([LR * 2 + 12, 0, 1.5]) base();
