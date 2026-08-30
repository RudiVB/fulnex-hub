// ============================================================
//  FLX-DOOR-1 — the door pair (Rev A)
//  FULNEX · matte black PETG · two pieces, like the renders:
//   - the BAR on the frame: reed switch + ESP32-C3 + CR2032,
//     FULNEX + dot + DOOR debossed on its face
//   - the MAGNET block on the door: solid, battery-free, a single
//     debossed alignment line that meets the bar's line
//
//  Mount with tape pads (recessed zones) or one screw (keyhole
//  in the bar's back plate). Gap tolerance ~12 mm.
//
//  Print both faces DOWN — crisp deboss, no supports.
// ============================================================

part = "all";         // "bar" | "back" | "magnet" | "all"

/* ---------- the bar ---------- */
BL = 66;              // length
BW = 26;              // width
BH = 13;              // height
BR = 11;              // end radius (soft pill)
BWALL = 2.0;
BTOP = 1.8;

pipe_d = 1.6;

/* ---------- back plate ---------- */
BACK_T = 1.6;

/* ---------- the magnet block ---------- */
ML = 26; MW = 12; MH = 13;   // matches the bar's profile height
mag_d = 8.2; mag_h = 3.2;    // pocket for an 8x3 disc magnet

$fn = 64;

/* ============ helpers ============ */
module pill(l, w, r) {
  hull() for (x = [r, l - r]) translate([x, w/2]) circle(r);
}

/* ============ BAR ============ */
module bar() {
  difference() {
    // soft body: rounded plan, chamfered top edge
    union() {
      hull() {
        linear_extrude(0.01) offset(-2.5) pill(BL, BW, BR);
        translate([0, 0, 2.5]) linear_extrude(0.01) pill(BL, BW, BR);
      }
      translate([0, 0, 2.5]) linear_extrude(BH - 2.5) pill(BL, BW, BR);
    }
    // cavity, open at the back (top of print = the face)
    translate([0, 0, -BTOP])
      linear_extrude(BH - BTOP) offset(-BWALL) pill(BL, BW, BR);
    // face is at z = BH (printed face-down): deboss identity
    translate([BL/2, BW/2 + 5.5, BH - 0.6])
      linear_extrude(0.7)
        text("FULNEX", size = 3.2, font = "Arial:style=Bold",
             halign = "center", valign = "center", spacing = 1.3);
    translate([BL/2, BW/2 - 6, BH - 0.6])
      linear_extrude(0.7)
        text("DOOR", size = 2.6, font = "Arial:style=Bold",
             halign = "center", valign = "center", spacing = 1.5);
    // LED dot between the words
    translate([BL/2, BW/2, BH - 3]) cylinder(d = pipe_d, h = 4);
    // alignment line on the magnet-side long edge
    translate([BL/2 - 6, 0.6, BH - 4])
      rotate([90, 0, 0]) linear_extrude(0.7) square([12, 1.2]);
  }
  // screw bosses for the back plate
  for (x = [10, BL - 10])
    translate([x, BW/2, 0])
      difference() {
        cylinder(d = 6, h = BH - BTOP - 0.4);
        translate([0, 0, 2]) cylinder(d = 1.7, h = BH);
      }
}

/* ============ BACK PLATE ============ */
module back() {
  difference() {
    linear_extrude(BACK_T) offset(-BWALL - 0.25) pill(BL, BW, BR);
    // screws through, countersunk
    for (x = [10, BL - 10]) {
      translate([x, BW/2, -0.1]) cylinder(d = 2.4, h = BACK_T + 1);
      translate([x, BW/2, -0.01]) cylinder(d1 = 4.6, d2 = 2.4, h = 1.2);
    }
    // keyhole, centre
    translate([BL/2 + 3, BW/2, -0.1]) cylinder(d = 6.5, h = BACK_T + 1);
    hull() {
      translate([BL/2 + 3, BW/2, -0.1]) cylinder(d = 3.2, h = BACK_T + 1);
      translate([BL/2 - 5, BW/2, -0.1]) cylinder(d = 3.2, h = BACK_T + 1);
    }
    // shallow tape recess zones at the ends
    for (x = [4, BL - 16])
      translate([x, BW/2 - 7.2, -0.01]) cube([12, 14.4 - BWALL * 2, 0.5]);
  }
  // CR2032 pocket ring (bare cell, contacts are wired)
  translate([BL - 22, BW/2, 0])
    difference() {
      cylinder(d = 21.6 + 2.4, h = BACK_T + 2);
      translate([0, 0, BACK_T]) cylinder(d = 20.6, h = 4);
      translate([0, 0, -0.1]) cylinder(d = 14, h = BACK_T + 3);
    }
  // C3 board end-stops (board 22.5 x 18 lies flat at the other end)
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
    // magnet pocket, opens at the back
    translate([ML/2, MW/2, -0.1]) cylinder(d = mag_d, h = mag_h + 0.1);
    // tape recess around it
    translate([ML/2 - 9, MW/2 - 4, -0.01]) cube([18, 8, 0.4]);
    // the matching alignment line on the bar-facing edge
    translate([ML/2 - 6, 0.6, MH - 4])
      rotate([90, 0, 0]) linear_extrude(0.7) square([12, 1.2]);
  }
}

/* ============ layout ============ */
if (part == "bar" || part == "all") bar();
if (part == "back") back();
if (part == "all") translate([0, BW + 12, 0]) back();
if (part == "magnet") magnet();
if (part == "all") translate([BL + 12, (BW - MW)/2, 0]) magnet();
