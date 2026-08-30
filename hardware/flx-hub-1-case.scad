// ============================================================
//  FLX-HUB-1 — Rev B enclosure (the squircle)
//  FULNEX · matte black PETG · matches the product renders:
//  soft square footprint, crowned lid, FULNEX across the face,
//  LED dot on top, NO visible screws (they enter from below).
//
//  Parts: base (walls, ports, interior fit-out), lid (crown,
//  deboss, light pipe, hidden posts), deck (ESP32 snap carrier).
//
//  Assembly (Olof):
//    1. print base + lid + deck, matte PETG, lid face-down
//    2. press the 2 rear jacks (P1 temp bus, P2 universal)
//    3. snap the DevKit into the deck, screw deck onto standoffs
//    4. buck + USB-C modules into their trays
//    5. tie the short jack harness to the rear bridge
//    6. lid on, 4 screws from UNDERNEATH, QR label in the recess
//  Senses are FLX pucks over Bluetooth; wired probes use the two
//  rear jacks. Relays/IO live in appliance SKUs, not this hub.
// ============================================================

/* ---------- what to render ---------- */
part = "both";        // "base" | "lid" | "deck" | "both"

/* ---------- master dimensions (mm) ---------- */
W  = 120;             // square squircle footprint
D  = 120;
H  = 34;              // base wall height (2 side rows fit)
R  = 34;              // corner radius — properly soft, like the render
T  = 2.4;             // wall
Tf = 2.8;             // floor
Tlid = 3.0;           // lid plate (crown rises above)

/* ---------- Rev C: the SEALED hub ----------------------------
   Senses reach the hub over Bluetooth (FLX pucks); the hub's job
   is to listen and bridge to Wi-Fi. The body carries nothing but
   power and two discreet rear jacks — P1 (the 8-probe temp bus)
   and P2 (universal) — for the wired cases that genuinely earn
   a cable (geyser probe, kas probe). Relays and IO breakouts
   live in appliance products and the future FLX-IO, not here. */
jack_d = 6.4;
side_jack_ys = [62, 74];            // P1, P2 on the LEFT wall, near the rear
side_jack_z = 11;

/* ---------- rear: USB window straight to the ESP -------------
   The deck docks the DevKit's own USB connector at this window:
   the wall cable powers the board directly (onboard regulator),
   and provisioning happens through the hole — lid stays on.    */
// snug to the slim cable we ship in the box; the wall's inner half
// flares wider so the plug funnels onto the connector by itself
usb_w = 10; usb_h = 6; usb_cx = 60; usb_z = 12;

/* ---------- interior fit-out (sealed hub = simple) ----------
   The deck sits PORTRAIT against the rear wall so the DevKit's
   USB connector reaches the rear window. One optional tray up
   front for any future module; one bridge for the jack wires. */
pcb_w = 50;  pcb_d = 70;  pcb_x = 35; pcb_y = 47;
standoff_h = 5;  standoff_d = 7;  screw_d = 2.6;
buck_x = 14;  buck_y = 8;  buck_w = 26; buck_d = 18;

/* ---------- lid details ---------- */
pipe_d = 2.0;                       // LED dot, on the TOP face
logo = "FULNEX";
logo_depth = 0.8;
crown_inset = 11;                   // how far the crown shoulder steps in
crown_rise = 3.4;                   // how much the crown rises
// posts pushed into the corners, CLEAR of the deck (verified: the
// deck spans 18..88 x 30..80; posts at 25/95 never touch it)
lidpost_xy = [[25, 25], [95, 25], [25, 95], [95, 95]];

vent_n = 8;
label_w = 34; label_h = 34; label_t = 0.6;

$fn = 64;

/* ============ helpers ============ */
module squircle(w, d, r) {
  hull() for (x = [r, w - r], y = [r, d - r]) translate([x, y]) circle(r);
}
module shell2d() {
  difference() { squircle(W, D, R); offset(-T) squircle(W, D, R); }
}
module post(x, y, h = 4, d = 6, hole = 2.2) {
  translate([x, y, Tf]) difference() {
    cylinder(d = d, h = h);
    cylinder(d = hole, h = h + 1);
  }
}
module tray(x, y, w, d, wall = 1.6, h = 3.2) {
  translate([x, y, Tf]) difference() {
    cube([w, d, h]);
    translate([wall, -1, -1]) cube([w - 2 * wall, d - wall + 1, h + 2]);
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
      // floor with a soft chamfered bottom edge
      hull() {
        linear_extrude(0.01) offset(-1.8) squircle(W, D, R);
        translate([0, 0, 1.6]) linear_extrude(0.01) squircle(W, D, R);
      }
      translate([0, 0, 1.6]) linear_extrude(Tf - 1.6) squircle(W, D, R);
      linear_extrude(H) shell2d();

      // deck standoffs
      for (x = [pcb_x + 5, pcb_x + pcb_w - 5],
           y = [pcb_y + 5, pcb_y + pcb_d - 5])
        translate([x, y, Tf])
          difference() {
            cylinder(d = standoff_d, h = standoff_h);
            cylinder(d = screw_d,    h = standoff_h + 1);
          }
      // one optional module tray, front-left
      tray(buck_x, buck_y, buck_w, buck_d);
      // harness bridge — jack wires run along the left, under the deck
      tiebar(16, 60);
    }

    // ---- left wall: two discreet sense jacks (P1 temp bus, P2) ----
    for (y = side_jack_ys)
      translate([-1, y, side_jack_z])
        rotate([0, 90, 0]) cylinder(d = jack_d, h = T + 4);

    // ---- rear chord: USB window (snug outside, funnel inside) ----
    translate([usb_cx - usb_w/2, D - T - 1, usb_z - usb_h/2])
      cube([usb_w, T + 4, usb_h]);
    hull() {
      translate([usb_cx - usb_w/2, D - T/2, usb_z - usb_h/2])
        cube([usb_w, 0.01, usb_h]);
      translate([usb_cx - usb_w/2 - 2.5, D - T - 0.5, usb_z - usb_h/2 - 1.5])
        cube([usb_w + 5, 0.01, usb_h + 3]);
    }

    // ---- lid screws come up from BELOW: countersunk floor holes ----
    for (p = lidpost_xy) {
      translate([p[0], p[1], -1]) cylinder(d = 3, h = Tf + 2);
      translate([p[0], p[1], -0.01]) cylinder(d1 = 6.2, d2 = 3, h = 1.6);
    }

    // ---- floor vents, under the board ----
    for (i = [0 : vent_n - 1])
      translate([22 + i * 10, 44, -1])
        linear_extrude(Tf + 2) squircle(3, 12, 1.4);

    // ---- QR label recess, underside ----
    translate([W/2 - label_w/2, D/2 - label_h/2, -0.01])
      cube([label_w, label_h, label_t]);
  }

  // base inscription beside the label recess
  translate([W/2, D/2 - label_h/2 - 5, label_t])
    rotate([180, 0, 0])
      linear_extrude(0.5)
        text("FLX-HUB-1  ·  REV B", size = 3.2,
             font = "Arial:style=Bold", halign = "center");
}

/* ============ LID ============ */
// Crowned squircle: plate + soft raised centre, FULNEX deboss,
// LED dot on the face, four hidden posts reaching the floor.
// Print upside-down: the crown against the plate = crisp deboss.
module lid() {
  difference() {
    union() {
      // plate with a chamfered underside edge (shadow-gap seam)
      hull() {
        linear_extrude(0.01) offset(-1.6) squircle(W, D, R);
        translate([0, 0, 1.4]) linear_extrude(0.01) squircle(W, D, R);
      }
      translate([0, 0, 1.4]) linear_extrude(Tlid - 1.4) squircle(W, D, R);
      // the crown: a soft shoulder rising to a smaller squircle
      hull() {
        translate([0, 0, Tlid - 0.01]) linear_extrude(0.01)
          offset(-1.5) squircle(W, D, R);
        translate([0, 0, Tlid + crown_rise - 0.01]) linear_extrude(0.01)
          offset(-crown_inset) squircle(W, D, R);
      }
      // inner lip that seats inside the walls
      translate([0, 0, -3])
        linear_extrude(3)
          difference() {
            offset(-T - 0.25) squircle(W, D, R);
            offset(-T - 2.25) squircle(W, D, R);
          }
      // hidden screw posts down to the floor
      for (p = lidpost_xy)
        translate([p[0], p[1], -(H - Tf - Tlid + 2.6)])
          cylinder(d = 8, h = H - Tf - Tlid + 2.6);
    }
    // FULNEX across the face
    translate([W/2, D/2 + 6, Tlid + crown_rise - logo_depth])
      linear_extrude(logo_depth + 0.1)
        text(logo, size = 12, font = "Arial:style=Bold",
             halign = "center", valign = "center", spacing = 1.3);
    // the LED dot — on the top face, lower-centre, like the render
    translate([W/2, D/2 - 26, -H]) cylinder(d = pipe_d, h = H + Tlid + crown_rise + 2);
    // screw threads into the posts, from below
    for (p = lidpost_xy)
      translate([p[0], p[1], -(H - Tf - Tlid + 3)])
        cylinder(d = 2.2, h = 14);
  }
}

/* ============ DECK ============ */
// The part the ESP32 lives in: snaps around a DevKit V1, screws
// onto the base standoffs. Pin headers hang through the opening.
dk_l = 49.5;
dk_w = 29.0;

module deck_cradle() {
  translate([-2, -2, 2]) cube([10, 2, 3]);
  translate([-2, -2, 2]) cube([2, 10, 3]);
  translate([0, -0.1, 3.9]) cube([5, 1, 1]);
  translate([-0.1, 0, 3.9]) cube([1, 5, 1]);
}

module deck() {
  // portrait: the DevKit lies along the plate's LONG axis, its USB
  // end 2 mm from the rear edge, so the connector meets the case
  // window. Antenna end faces the room (best radio, least metal).
  bay_x = (pcb_w - dk_w) / 2;
  bay_y = pcb_d - 2 - dk_l;
  difference() {
    cube([pcb_w, pcb_d, 2]);
    translate([bay_x - 1, bay_y + 7, -1]) cube([dk_w + 2, dk_l - 14, 4]);
    translate([bay_x + 7, bay_y - 1, -1]) cube([dk_w - 14, dk_l + 2, 4]);
    for (x = [5, pcb_w - 5], y = [5, pcb_d - 5])
      translate([x, y, -1]) cylinder(d = 3, h = 4);
    // harness pass-through slots, front half
    translate([pcb_w/2 - 6, 8, -1]) cube([12, 4, 4]);
    translate([pcb_w/2 - 6, 22, -1]) cube([12, 4, 4]);
  }
  // front corners: full L-cradles
  translate([bay_x, bay_y, 0]) deck_cradle();
  translate([bay_x + dk_w, bay_y, 0]) rotate([0, 0, 90]) deck_cradle();
  // USB end: side-only clips — nothing crosses the connector's path
  translate([bay_x, bay_y + dk_l - 8, 0]) deck_side_clip();
  translate([bay_x + dk_w, bay_y + dk_l - 8, 0]) mirror([1, 0, 0]) deck_side_clip();
}

module deck_side_clip() {   // wall + lip along one side, board at +x
  translate([-2, 0, 2]) cube([2, 8, 3]);
  translate([-0.1, 1.5, 3.9]) cube([1, 5, 1]);
}

/* ============ layout ============ */
if (part == "base" || part == "both") base();
if (part == "lid")  lid();
if (part == "deck") deck();
if (part == "both") translate([W + 16, 0, Tlid + crown_rise]) rotate([0, 180, 0])
  translate([-W, 0, -Tlid]) lid();
