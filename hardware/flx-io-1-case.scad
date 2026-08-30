use <fulnex-logo.scad>;
// ============================================================
//  FLX-IO-1 — the 12-port pro module (Rev A)
//  FULNEX · matte black PETG · where the wires live.
//
//  The consumer hub went sealed; THIS is where the 12-jack
//  faceplate belongs: workshops, plants, machine rooms. Ports
//  proudly on the front, powered over USB, three switched
//  outputs at the back. Runs the same one-binary firmware —
//  the port map is just desired.pm.
//
//  Front: 12 sense jacks, 2 rows of 6 (P1 temp bus + 11 more).
//  Rear:  USB window docking the DevKit deck (power + provision
//         through the hole) + 3 output cable grommets.
//  Lid:   FULNEX · FLX-IO · dot, 4 serviceable top screws.
//  Base:  wall keyholes (both slot directions), QR recess.
// ============================================================

part = "both";        // "base" | "lid" | "both"

/* ---------- master ---------- */
W = 128;  D = 92;  H = 34;  R = 10;
T = 2.4;  Tf = 2.8;  Tlid = 3.0;

/* ---------- front: 12 jacks ---------- */
jack_d = 6.4;
jack_cols = 6;  jack_pitch = 16;
jack_rows_z = [11, 24];

/* ---------- rear ---------- */
usb_w = 10; usb_h = 6; usb_cx = 64; usb_z = 12;
out_d = 8.2; out_z = 12;
out_xs = [22, 38, 106];

/* ---------- interior ---------- */
pcb_w = 50;  pcb_d = 70;  pcb_x = 39; pcb_y = 19;   // portrait deck, USB to rear
standoff_h = 5;  standoff_d = 7;  screw_d = 2.6;
relay_x = 96; relay_y = 30; relay_w = 26; relay_d = 44;
lidboss_xy = [[12, 12], [116, 12], [12, 80], [116, 80]];

pipe_d = 1.8;
label_w = 34; label_h = 34; label_t = 0.6;
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
module tiebar(x, y) {
  translate([x, y, Tf]) {
    cube([2, 6, 3.4]);
    translate([7, 0, 0]) cube([2, 6, 3.4]);
    translate([0, 0, 2.4]) cube([9, 6, 1]);
  }
}

/* ============ BASE ============ */
module base() {
  difference() {
    union() {
      linear_extrude(Tf) squircle(W, D, R);
      linear_extrude(H)
        difference() { squircle(W, D, R); offset(-T) squircle(W, D, R); }
      // deck standoffs (portrait, USB end to the rear window)
      for (x = [pcb_x + 5, pcb_x + pcb_w - 5],
           y = [pcb_y + 5, pcb_y + pcb_d - 5])
        translate([x, y, Tf])
          difference() {
            cylinder(d = standoff_d, h = standoff_h);
            cylinder(d = screw_d,    h = standoff_h + 1);
          }
      // relay module posts, right column by the grommets... the
      // outputs exit left AND right; relays sit right
      for (x = [relay_x + 3, relay_x + relay_w - 3],
           y = [relay_y + 3, relay_y + relay_d - 3])
        post(x, y);
      // lid screw bosses
      for (p = lidboss_xy)
        translate([p[0], p[1], Tf])
          difference() {
            cylinder(d = 7, h = H - Tf);
            translate([0, 0, H - Tf - 9]) cylinder(d = 2.2, h = 10);
          }
      // harness bridges along the front
      tiebar(30, 16);
      tiebar(60, 16);
      tiebar(90, 16);
    }

    // ---- front: 12 jacks, 2 rows of 6 ----
    x0 = W/2 - (jack_cols - 1) * jack_pitch / 2;
    for (c = [0 : jack_cols - 1], z = jack_rows_z)
      translate([x0 + c * jack_pitch, T + 1, z])
        rotate([90, 0, 0]) cylinder(d = jack_d, h = T + 4);

    // ---- rear: USB window (snug + funnel) to the deck ----
    translate([usb_cx - usb_w/2, D - T - 1, usb_z - usb_h/2])
      cube([usb_w, T + 4, usb_h]);
    hull() {
      translate([usb_cx - usb_w/2, D - T/2, usb_z - usb_h/2])
        cube([usb_w, 0.01, usb_h]);
      translate([usb_cx - usb_w/2 - 2.5, D - T - 0.5, usb_z - usb_h/2 - 1.5])
        cube([usb_w + 5, 0.01, usb_h + 3]);
    }
    // ---- rear: 3 output grommets ----
    for (x = out_xs)
      translate([x, D - T - 1, out_z])
        rotate([-90, 0, 0]) cylinder(d = out_d, h = T + 4);

    // ---- wall keyholes: classic portrait, hook-and-hang ----
    for (x = [20, 108]) {
      translate([x, 54, -0.1]) cylinder(d = 7, h = Tf + 1);
      hull() {
        translate([x, 54, -0.1]) cylinder(d = 3.4, h = 1.6);
        translate([x, 40, -0.1]) cylinder(d = 3.4, h = 1.6);
      }
    }

    // ---- floor vents under the relay column ----
    for (i = [0 : 3])
      translate([98 + i * 6, 52, -1])
        linear_extrude(Tf + 2) squircle(3, 14, 1.4);

    // ---- the slit: the family's parting line ----
    translate([0, 0, 5])
      linear_extrude(1.2)
        difference() {
          offset(1) squircle(W, D, R);
          offset(-0.8) squircle(W, D, R);
        }

    // ---- QR label recess ----
    translate([W/2 - label_w/2, D/2 - label_h/2, -0.01])
      cube([label_w, label_h, label_t]);
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
    translate([W/2, D/2 + 10, Tlid - 0.6])
      linear_extrude(0.7)
        fulnex_logo(7.5);
    translate([W/2, D/2 - 10, Tlid - 0.6])
      linear_extrude(0.7)
        text("FLX-IO", size = 2.8, font = "Michroma",
             halign = "center", valign = "center", spacing = 1.5);
    translate([W/2 + fulnex_eye_x(7.5), D/2 + 10, -1]) cylinder(d = pipe_d, h = Tlid + 2);
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
