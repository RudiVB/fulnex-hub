// ============================================================
//  FLX-GEYSER-1 — the geyser switch (Rev A)
//  FULNEX · wall box, electrician-installed, two chambers:
//
//   MAINS side (left):  HLK-PM01 mains PSU + relay that switches
//                       the geyser CONTACTOR COIL only — the
//                       heavy current stays in the DB board.
//   LOW-V side (right): ESP32 brain + the wired temp-probe jack
//                       (probe goes into the geyser's sleeve).
//
//  A full-height internal barrier separates the chambers; wires
//  cross through one small slot at the back. Two gland holes on
//  the bottom edge (supply in, coil out), probe jack beside them
//  on the low-voltage side. Keyholes in the back for the wall.
//  Lid: FULNEX · dot · GEYSER, 4 countersunk screws (installer
//  product — serviceability beats invisible fasteners here).
//
//  SAFETY: pilot units are electrician-installed and supervised.
//  Production shells must move to V0-rated plastic (ABS/PC) —
//  PETG is for bench prototypes ONLY. Creepage kept >= 6 mm.
// ============================================================

part = "both";        // "base" | "lid" | "both"

/* ---------- master ---------- */
W = 104;  D = 74;  H = 32;
R = 14;
T = 2.4;  Tf = 2.8;  Tlid = 2.6;

barrier_x = 58;       // mains chamber = x < barrier, LV = x > barrier
barrier_t = 2.0;

/* ---------- bottom-edge penetrations ---------- */
gland_d = 12.6;       // M12 cable glands, mains side
gland_xs = [20, 40];
jack_d = 6.4;         // temp probe jack, LV side
jack_x = 84;
hole_z = 13;

/* ---------- interior ---------- */
psu_x = 8;  psu_y = 40;  psu_w = 35; psu_d = 21;   // HLK-PM01 tray
relay_x = 8; relay_y = 8; relay_w = 42; relay_d = 26; // relay posts
c3_x = 66;  c3_y = 42;                              // C3 rails
lidboss_xy = [[10, 10], [94, 10], [10, 64], [94, 64]];

pipe_d = 1.8;
$fn = 64;

module squircle(w, d, r) {
  hull() for (x = [r, w - r], y = [r, d - r]) translate([x, y]) circle(r);
}
module post(x, y, h = 4, d = 6, hole = 2.2) {
  translate([x, y, Tf]) difference() {
    cylinder(d = d, h = h);
    cylinder(d = hole, h = h + 1);
  }
}
module tray(x, y, w, d, wall = 1.6, h = 3.6) {
  translate([x, y, Tf]) difference() {
    cube([w, d, h]);
    translate([wall, -1, -1]) cube([w - 2 * wall, d - wall + 1, h + 2]);
  }
}

/* ============ BASE ============ */
module base() {
  difference() {
    union() {
      linear_extrude(Tf) squircle(W, D, R);
      linear_extrude(H)
        difference() { squircle(W, D, R); offset(-T) squircle(W, D, R); }
      // the mains barrier — full height, wires cross one rear slot
      difference() {
        translate([barrier_x, T, Tf]) cube([barrier_t, D - 2 * T, H - Tf]);
        translate([barrier_x - 1, D - T - 12, Tf + 4]) cube([barrier_t + 2, 8, 8]);
      }
      // HLK-PM01 drop-in tray (mains side)
      tray(psu_x, psu_y, psu_w, psu_d);
      // relay module posts (mains side)
      for (x = [relay_x + 3, relay_x + relay_w - 3],
           y = [relay_y + 3, relay_y + relay_d - 3])
        post(x, y);
      // C3 rails (LV side) — board 22.5 x 18 lies flat
      for (y = [c3_y - 9.6, c3_y + 8])
        translate([c3_x, y, Tf]) cube([20, 1.6, 3]);
      translate([c3_x - 1.6, c3_y - 9.6, Tf]) cube([1.6, 19.2, 3]);
      // lid screw bosses
      for (p = lidboss_xy)
        translate([p[0], p[1], Tf])
          difference() {
            cylinder(d = 7, h = H - Tf);
            translate([0, 0, H - Tf - 9]) cylinder(d = 2.2, h = 10);
          }
    }

    // bottom edge: 2 gland holes (mains) + the probe jack (LV)
    for (x = gland_xs)
      translate([x, T + 1, hole_z])
        rotate([90, 0, 0]) cylinder(d = gland_d, h = T + 4);
    translate([jack_x, T + 1, hole_z])
      rotate([90, 0, 0]) cylinder(d = jack_d, h = T + 4);

    // wall keyholes through the back plate
    for (x = [30, 74]) {
      translate([x, 44, -0.1]) cylinder(d = 7, h = Tf + 1);
      hull() {
        translate([x, 44, -0.1]) cylinder(d = 3.4, h = 1.6);
        translate([x, 34, -0.1]) cylinder(d = 3.4, h = 1.6);
      }
    }

    // vents on the LV side wall only (mains chamber stays closed)
    for (i = [0 : 3])
      translate([W - T - 1, 22 + i * 10, H - 8])
        rotate([0, 90, 0]) linear_extrude(T + 2) squircle(3, 6, 1.4);
  }
}

/* ============ LID ============ */
module lid() {
  difference() {
    union() {
      linear_extrude(Tlid) squircle(W, D, R);
      translate([0, 0, -2.5])
        linear_extrude(2.5)
          difference() {
            offset(-T - 0.25) squircle(W, D, R);
            offset(-T - 2.05) squircle(W, D, R);
          }
    }
    // identity
    translate([W/2, D/2 + 8, Tlid - 0.6])
      linear_extrude(0.7)
        text("FULNEX", size = 4.2, font = "Arial:style=Bold",
             halign = "center", valign = "center", spacing = 1.35);
    translate([W/2, D/2 - 9, Tlid - 0.6])
      linear_extrude(0.7)
        text("GEYSER", size = 3.2, font = "Arial:style=Bold",
             halign = "center", valign = "center", spacing = 1.5);
    // LED dot between the words
    translate([W/2, D/2, -1]) cylinder(d = pipe_d, h = Tlid + 2);
    // 4 countersunk screws into the base bosses
    for (p = lidboss_xy) {
      translate([p[0], p[1], -3]) cylinder(d = 2.6, h = Tlid + 4);
      translate([p[0], p[1], Tlid - 1.3]) cylinder(d1 = 2.6, d2 = 5.4, h = 1.4);
    }
  }
}

/* ============ layout ============ */
if (part == "base" || part == "both") base();
if (part == "lid") lid();
if (part == "both") translate([W + 14, 0, Tlid]) rotate([0, 180, 0])
  translate([-W, 0, -Tlid]) lid();
