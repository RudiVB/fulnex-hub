use <fulnex-logo.scad>;
// ============================================================
//  FLX-SOIL-1 — the soil spike head (Rev A)
//  FULNEX · one printed piece that caps the common capacitive
//  soil probe (v1.2 board, ~23 mm wide): the electronics end
//  slides up into the pocket, the blade stays in the dirt, the
//  cable leaves through the top gland hole. Keeps water off the
//  components — the whole reason garden probes die.
//
//  Print opening-down as modelled (no supports). A bead of
//  silicone in the pocket lip seals it against rain.
// ============================================================

bw = 23.6;            // board width (+ tolerance)
bt = 2.2;             // board thickness through the pocket
depth = 32;           // how much of the electronics end is covered

OW = 34;  OD = 12;  OH = depth + 6;   // outer head
R = 5;
cable_d = 4.6;

$fn = 48;

module rbox(w, d, h, r) {
  hull()
    for (x = [r, w - r], y = [r, d - r])
      translate([x, y]) cylinder(r = r, h = h);
}

difference() {
  rbox(OW, OD, OH, R);
  // board pocket, open at the bottom
  translate([(OW - bw)/2, (OD - bt)/2, -0.1]) cube([bw, bt, depth + 0.1]);
  // component relief either side of the board slot
  translate([(OW - bw)/2 + 2, (OD - bt)/2 - 1.4, -0.1]) cube([bw - 4, bt + 2.8, depth - 4]);
  // cable out the top
  translate([OW/2, OD/2, OH - 4]) cylinder(d = cable_d, h = 5);
  // the slit: the family's parting line around the head
  translate([0, 0, OH - 10])
    difference() {
      translate([-1, -1, 0]) cube([OW + 2, OD + 2, 1.1]);
      translate([0.8, 0.8, -0.5]) rbox(OW - 1.6, OD - 1.6, 2.1, R - 0.8);
    }
  // identity on the face — the logotype horizontal, SOIL beneath
  translate([OW/2, 1.0, OH - 5])
    rotate([90, 0, 0]) linear_extrude(1.1)
      fulnex_logo(2.6);
  translate([OW/2, 1.0, OH - 15])
    rotate([90, 0, 0]) linear_extrude(0.9)
      text("SOIL", size = 1.8, font = "Michroma",
           halign = "center", valign = "center", spacing = 1.5);
}
