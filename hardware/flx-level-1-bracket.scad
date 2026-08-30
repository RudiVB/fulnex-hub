// ============================================================
//  FLX-LEVEL-1 — the tank level bracket (Rev A)
//  FULNEX · aims an HY-SRF05 / HC-SR04 ultrasonic sensor straight
//  down into a water tank. The two transducer barrels drop through
//  the deck holes; side clips grip the board; the flange screws to
//  the tank lid or rim through two slots (slots forgive sloppy
//  drilling). Cable leaves through the flange notch.
//
//  Print flange-down as modelled — no supports.
// ============================================================

board_l = 45.5;       // sensor board (+ tolerance)
board_w = 20.5;
barrel_d = 16.6;      // transducer barrels
barrel_cc = 26;       // centre-to-centre

PT = 3;               // plate thickness
lip = 6;              // clip walls height
FH = 32;              // flange height
FT = 3;

$fn = 48;

module bracket() {
  deck_l = board_l + 8;
  deck_w = board_w + 8;

  // ---- deck: the sensor faces down through it ----
  difference() {
    hull()
      for (x = [4, deck_l - 4], y = [4, deck_w - 4])
        translate([x, y]) cylinder(r = 4, h = PT);
    for (s = [-1, 1])
      translate([deck_l/2 + s * barrel_cc/2, deck_w/2, -0.1])
        cylinder(d = barrel_d, h = PT + 1);
  }
  // board clip walls with inward lips
  for (y = [4 - 2, deck_w - 4 + 0.0]) ;
  for (s = [0, 1]) {
    ys = s == 0 ? (deck_w - board_w)/2 - 1.6 : (deck_w + board_w)/2;
    translate([(deck_l - board_l)/2, ys, PT]) cube([board_l, 1.6, lip]);
    translate([(deck_l - board_l)/2 + 6, s == 0 ? ys + 1.5 : ys - 0.9, PT + lip - 1])
      cube([8, 1, 1]);
    translate([(deck_l - board_l)/2 + board_l - 14, s == 0 ? ys + 1.5 : ys - 0.9, PT + lip - 1])
      cube([8, 1, 1]);
  }
  // end stops
  for (x = [(deck_l - board_l)/2 - 1.6, (deck_l + board_l)/2])
    translate([x, (deck_w - board_w)/2, PT]) cube([1.6, board_w, lip - 2]);

  // ---- flange: vertical, screws to the tank ----
  difference() {
    translate([-FT, 0, 0]) cube([FT, deck_w, FH]);
    // two screw slots
    for (z = [FH - 8, FH - 20])
      hull() {
        translate([-FT - 0.1, deck_w/2 - 5, z]) rotate([0, 90, 0]) cylinder(d = 4.2, h = FT + 1);
        translate([-FT - 0.1, deck_w/2 + 5, z]) rotate([0, 90, 0]) cylinder(d = 4.2, h = FT + 1);
      }
    // cable notch at the deck junction
    translate([-FT - 0.1, deck_w/2 - 3, 2]) cube([FT + 1, 6, 5]);
    // identity
    translate([-FT + 0.5, deck_w/2, FH - 26])
      rotate([90, -90, 90]) linear_extrude(0.6)
        text("FULNEX · LEVEL", size = 2.4, font = "Arial:style=Bold",
             halign = "center", valign = "center", spacing = 1.3);
  }
  // gusset ribs
  for (y = [2, deck_w - 4])
    translate([0, y, PT])
      rotate([90, 0, 90]) linear_extrude(2) polygon([[0, 0], [10, 0], [0, 14]]);
}

bracket();
