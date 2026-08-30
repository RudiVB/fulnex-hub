use <fulnex-logo.scad>;
// ============================================================
//  FLX-HOP-1 — the solar LoRa hop station (Rev A)
//  FULNEX · PETG (ASA later for UV) · the bucket-brigade box:
//  hears a LoRa message, shouts it onward. Lives on a pole or
//  windmill leg, faces the sun, owes nobody a cable.
//
//  Inside, floor to lid:
//   - 18650 cell in a holder, screwed to the floor (cell LOCAL)
//   - perfboard on posts: ESP32-C3 + E220-900T22D + TP4056-type
//     solar charge board with protection
//   - spring antenna zip-tied high inside — PETG is transparent
//     to radio, so the box stays SEALED. No gland, no leak.
//  Roof: sloped face holds a ~100x70 5V solar panel in a recess,
//  wire through the roof hole (silicone dab). Roof overhangs the
//  body 4mm all round — a drip edge, like a farm roof.
//  Mount: rear channel hugs the pole, two strap slots take hose
//  clamps or fence wire. One small weep hole underneath.
// ============================================================

part = "both";        // "body" | "roof" | "both"

/* ---------- body ---------- */
W = 110; D = 80; H = 118; R = 8;
WALL = 2.4;

/* ---------- roof ---------- */
RW = 118; RD = 88;             // overhang 4mm all round
RF = 18;  RB = 64;             // steeper slope (~28 deg) - sheds better
SOLAR_L = 100; SOLAR_W = 70;   // panel GLUES onto a raised plinth
PLINTH_H = 4;                  // panel overhangs it 4mm all round -
                               // nothing upstanding, nothing to dam
                               // (Olof: grooves collect water + bird
                               // droppings; proud mounting self-cleans)

/* ---------- interior ---------- */
post_xy = [[10, 10], [W - 10, 10], [10, D - 10], [W - 10, D - 10]];
pipe_d = 1.6;

$fn = 48;

module squircle(w, d, r) {
  hull() for (x = [r, w - r], y = [r, d - r]) translate([x, y]) circle(r);
}

/* ============ BODY ============ */
module body() {
  difference() {
    union() {
      // solid shell minus interior cavity - walls and floor in one
      difference() {
        linear_extrude(H) squircle(W, D, R);
        translate([0, 0, WALL])
          linear_extrude(H) offset(-WALL) squircle(W, D, R);
      }
      // interior posts: perfboard deck screws at mid-height,
      // roof screws into the same posts at the top
      for (p = post_xy)
        translate([p[0], p[1], WALL])
          difference() {
            cylinder(d = 9, h = H - WALL);
            translate([0, 0, H - WALL - 12]) cylinder(d = 2.6, h = 13);
            translate([0, 0, 58]) cylinder(d = 2.6, h = 10);
          }
      // 18650 holder floor bosses (holder ~78 x 21, two screws)
      for (x = [W/2 - 30, W/2 + 30])
        translate([x, D/2, WALL])
          difference() {
            cylinder(d = 7, h = 5);
            cylinder(d = 2.6, h = 6);
          }
      // pole channel: a vertical cradle proud of the back wall
      translate([W/2 - 14, D - 1, 0]) cube([28, 7, H]);
    }
    // the pole's bed - a rounded vertical groove in that cradle
    translate([W/2, D + 13, -1]) cylinder(r = 12, h = H + 2);
    // strap slots through the cradle, high and low
    for (z = [22, H - 26])
      for (x = [W/2 - 26, W/2 + 18])
        translate([x, D - 3, z]) cube([8, 12, 14]);
    // face: the family identity
    translate([W/2, 1.2, H - 34])
      rotate([90, 0, 0]) linear_extrude(1.4)
        fulnex_logo(4.5);
    translate([W/2, 1.2, H - 52])
      rotate([90, 0, 0]) linear_extrude(0.9)
        text("HOP", size = 2.0, font = "Michroma",
             halign = "center", valign = "center", spacing = 1.5);
    // LED pipe through the X of the logo
    translate([W/2 + fulnex_eye_x(4.5), 4, H - 34])
      rotate([90, 0, 0]) cylinder(d = pipe_d, h = 6);
    // the family slit near the foot
    translate([0, 0, 8])
      linear_extrude(1.2)
        difference() {
          offset(1) squircle(W, D, R);
          offset(-0.8) squircle(W, D, R);
        }
    // weep hole - the one deliberate opening, underneath
    translate([W/2, D/2 - 20, -1]) cylinder(d = 3, h = WALL + 2);
  }
}

/* ============ ROOF ============ */
// sloped cap, slope rising front to back so the panel faces the
// sun. Print upside-down (flat skirt rim on the plate).
module roof() {
  ang = atan((RB - RF) / RD);
  difference() {
    // full-height block...
    linear_extrude(RB) squircle(RW, RD, 6);
    // ...with everything above the slope plane removed:
    // plane z = RF + y*tan(ang)
    translate([-10, 0, RF])
      rotate([ang, 0, 0])
        translate([0, -10, 0]) cube([RW + 20, RD + 40, 80]);
    // slip-over skirt: remove the body's footprint (plus play)
    // up to z=13 so the cap drops over the walls
    translate([(RW - W)/2 - 0.3, (RD - D)/2 - 0.3, -1])
      linear_extrude(14) squircle(W + 0.6, D + 0.6, R);
    // roof screws: two per side, horizontal into the body posts
    for (x = [(RW - W)/2 + 10, RW - (RW - W)/2 - 10]) {
      translate([x, -1, 8]) rotate([-90, 0, 0]) cylinder(d = 3.4, h = 14);
      translate([x, RD - 13, 8]) rotate([-90, 0, 0]) cylinder(d = 3.4, h = 14);
    }
    // panel wire hole down through the deck
    translate([RW/2, RD/2, -1]) cylinder(d = 5, h = 70);
  }
  // raised plinth ON the slope - the panel silicones onto this and
  // overhangs it on every side, so water and droppings run OFF the
  // panel edges, never against a lip
  zc = RF + (RB - RF)/2;
  difference() {
    translate([RW/2 - (SOLAR_L - 8)/2, RD/2, zc - 1])
      rotate([ang, 0, 0])
        translate([0, -(SOLAR_W - 8)/2, 0])
          cube([SOLAR_L - 8, SOLAR_W - 8, PLINTH_H + 1]);
    translate([RW/2, RD/2, -1]) cylinder(d = 5, h = 70);
  }
  // the kak-keil: a chevron ridge UPHILL (back) of the plinth -
  // apex points up the slope, arms open downhill, so runoff and
  // whatever the birds contribute splits AROUND the panel
  zk = RF + (RD/2 + 36) * (RB - RF) / RD;
  for (s = [-1, 1])
    translate([RW/2, RD/2 + 36, zk - 1.5])
      rotate([ang, 0, 0])
        rotate([0, 0, s < 0 ? 220 : -40])
          translate([0, -1.5, 0]) cube([34, 3, 5]);
}

/* ============ layout ============ */
if (part == "body" || part == "both") body();
if (part == "roof") roof();
if (part == "both") translate([W + 30, 0, 0]) roof();
