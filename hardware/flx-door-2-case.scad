use <fulnex-logo.scad>;
// ============================================================
//  FLX-DOOR-2 — the door pair, Rev B (Olof's AAA call)
//  FULNEX · matte black PETG · same two-piece idea as Rev A,
//  grown a few millimetres to swallow a standard 2xAAA holder:
//  3V at ~1200 mAh — five times the CR2032's life, cells from
//  any till. The pilot builds Rev A (CR2032 parts in hand);
//  THIS is the production direction.
//
//  Holder dims are the classic side-by-side 2xAAA shell —
//  VERIFY WITH CALIPER against the real part before printing.
// ============================================================

part = "all";         // "bar" | "back" | "magnet" | "all"

/* ---------- the bar ---------- */
BL = 82;              // length (Rev A was 66)
BW = 31;              // width  (Rev A was 26)
BH = 16;              // height (Rev A was 13)
BR = 13;
BWALL = 2.0;
BTOP = 1.8;

pipe_d = 1.6;

/* ---------- the 2xAAA holder (measure the real one!) ---------- */
AAAH_L = 52.5;
AAAH_W = 25.5;
AAAH_H = 13.0;

/* ---------- back plate ---------- */
BACK_T = 1.6;

/* ---------- the magnet block (same as Rev A, taller) ---------- */
ML = 26; MW = 12; MH = 16;
mag_l = 15.4; mag_w = 9.4; mag_h = 3.4;

$fn = 64;

module pill(l, w, r) {
  hull() for (x = [r, l - r]) translate([x, w/2]) circle(r);
}

/* ============ BAR ============ */
module bar() {
  difference() {
    union() {
      hull() {
        linear_extrude(0.01) offset(-2.5) pill(BL, BW, BR);
        translate([0, 0, 2.5]) linear_extrude(0.01) pill(BL, BW, BR);
      }
      translate([0, 0, 2.5]) linear_extrude(BH - 2.5) pill(BL, BW, BR);
    }
    // cavity, open at the back
    translate([0, 0, -BTOP])
      linear_extrude(BH - BTOP) offset(-BWALL) pill(BL, BW, BR);
    // face identity
    translate([BL/2, BW/2 + 6.4, BH - 0.6])
      linear_extrude(1.0)
        fulnex_logo(3.4);
    translate([BL/2, BW/2 - 6.6, BH - 0.6])
      linear_extrude(0.7)
        text("DOOR", size = 1.8, font = "Michroma",
             halign = "center", valign = "center", spacing = 1.5);
    translate([BL/2 + fulnex_eye_x(3.4), BW/2 + 6.4, BH - 3])
      cylinder(d = pipe_d, h = 4);
    // alignment line, magnet-side edge
    translate([BL/2 - 6, 0.6, BH - 4.5])
      rotate([90, 0, 0]) linear_extrude(0.7) square([12, 1.2]);
    // snap pockets for the back plate's spring tabs
    for (x = [14, BL - 23]) {
      translate([x, BWALL - 0.9, 2.0]) cube([9, 1.0, 1.8]);
      translate([x, BW - BWALL - 0.1, 2.0]) cube([9, 1.0, 1.8]);
    }
    // the family slit near the foot
    intersection() {
      difference() {
        translate([0, 0, -1]) linear_extrude(BH + 2) pill(BL, BW, BR);
        translate([0, 0, -2]) linear_extrude(BH + 4) offset(-0.8) pill(BL, BW, BR);
      }
      translate([11.2, -1, -1]) cube([1.3, BW + 2, BH + 3]);
    }
    translate([11.2, 3, BH - 0.7]) cube([1.3, BW - 6, 1]);
  }
}

/* ============ BACK PLATE ============ */
module back() {
  for (x = [14.5, BL - 22.5]) {
    for (y = [BWALL + 0.35, BW - BWALL - 1.55]) {
      translate([x, y, 0]) cube([8, 1.2, 3.2]);
      translate([x, y < BW/2 ? y - 0.6 : y + 1.2, 2.1])
        cube([8, 0.6, 1.0]);
    }
  }
  difference() {
    linear_extrude(BACK_T) offset(-BWALL - 0.25) pill(BL, BW, BR);
    // keyhole
    translate([BL/2 + 6, BW/2, -0.1]) cylinder(d = 6.5, h = BACK_T + 1);
    hull() {
      translate([BL/2 + 6, BW/2, -0.1]) cylinder(d = 3.2, h = BACK_T + 1);
      translate([BL/2 - 2, BW/2, -0.1]) cylinder(d = 3.2, h = BACK_T + 1);
    }
    // tape recesses at the ends
    for (x = [5, BL - 17])
      translate([x, BW/2 - 8, -0.01]) cube([12, 16 - BWALL * 2, 0.5]);
  }
  // 2xAAA holder bay: corner stops + a low fence, holder drops in
  // and the bar's ceiling holds it down. Wires exit the open corner.
  translate([BL - AAAH_L - 6, (BW - AAAH_W)/2, 0]) {
    for (p = [[-1.8, -1.8], [AAAH_L + 0.2, -1.8], [-1.8, AAAH_W + 0.2], [AAAH_L + 0.2, AAAH_W + 0.2]])
      translate([p[0], p[1], 0]) cube([1.6, 1.6, 4]);
    translate([-1.8, -1.8, 0]) cube([AAAH_L + 3.6, 1.6, 2.4]);
    translate([-1.8, AAAH_W + 0.2, 0]) cube([AAAH_L + 3.6, 1.6, 2.4]);
  }
  // C3 board end-stops at the other end (board 22.5 x 18 flat)
  for (y = [BW/2 - 9.6, BW/2 + 8])
    translate([5, y, 0]) cube([20, 1.6, 3]);
  translate([3.4, BW/2 - 9.6, 0]) cube([1.6, 19.2, 3]);
}

/* ============ MAGNET BLOCK ============ */
module magnet() {
  difference() {
    union() {
      hull() {
        linear_extrude(0.01) offset(-2) pill(ML, MW, 5);
        translate([0, 0, 2]) linear_extrude(0.01) pill(ML, MW, 5);
      }
      translate([0, 0, 2]) linear_extrude(MH - 2) pill(ML, MW, 5);
    }
    translate([ML/2 - mag_l/2, MW/2 - mag_w/2, -0.1])
      cube([mag_l, mag_w, mag_h + 0.1]);
    translate([ML/2 - 10, MW/2 - 4.9, -0.01]) cube([20, 9.8, 0.4]);
    translate([ML/2 - 6, 0.6, MH - 4.5])
      rotate([90, 0, 0]) linear_extrude(0.7) square([12, 1.2]);
    intersection() {
      difference() {
        translate([0, 0, -1]) linear_extrude(MH + 2) pill(ML, MW, 5);
        translate([0, 0, -2]) linear_extrude(MH + 4) offset(-0.8) pill(ML, MW, 5);
      }
      translate([ML/2 - 0.65, -1, -1]) cube([1.3, MW + 2, MH + 3]);
    }
    translate([ML/2 - 0.65, 2, MH - 0.7]) cube([1.3, MW - 4, 1]);
  }
}

/* ============ layout ============ */
if (part == "bar" || part == "all") bar();
if (part == "back") back();
if (part == "all") translate([0, BW + 12, 0]) back();
if (part == "magnet") magnet();
if (part == "all") translate([BL + 12, (BW - MW)/2, 0]) magnet();
