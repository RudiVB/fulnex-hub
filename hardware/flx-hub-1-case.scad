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
//    2. press 11 stereo jacks + 1 four-pole (P10) into the front
//    3. snap the DevKit into the deck, screw deck onto standoffs
//    4. relay module onto its posts; buck + USB-C into the trays
//    5. zip-tie the harness on the front bridges
//    6. lid on, 4 screws from UNDERNEATH, QR label in the recess
// ============================================================

/* ---------- what to render ---------- */
part = "both";        // "base" | "lid" | "deck" | "both"

/* ---------- master dimensions (mm) ---------- */
W  = 120;             // square squircle footprint
D  = 120;
H  = 38;              // base wall height (3 jack rows need it)
R  = 34;              // corner radius — properly soft, like the render
T  = 2.4;             // wall
Tf = 2.8;             // floor
Tlid = 3.0;           // lid plate (crown rises above)

/* ---------- front: 12 sense jacks on the flat chord ----------
   flat front spans x = R .. W-R  (52 mm at R=34): 3 rows of 4  */
jack_d = 6.4;
jack_cols = 4;  jack_pitch = 12;
jack_rows_z = [9, 19, 29];          // three rows on the front wall

/* ---------- rear: USB-C + 3 output grommets ---------- */
usb_w = 10; usb_h = 4.4; usb_cx = 43; usb_z = 8;
out_d = 8.2; out_z = 12;
out_xs = [56, 68, 80];

/* ---------- interior fit-out ---------- */
pcb_w = 70;  pcb_d = 50;  pcb_x = 18; pcb_y = 30;
standoff_h = 5;  standoff_d = 7;  screw_d = 2.6;
relay_x = 90; relay_y = 30; relay_w = 26; relay_d = 48;
buck_x = 16;  buck_y = 86;  buck_w = 26; buck_d = 18;
psu_x  = 46;  psu_y  = 98;  psu_w  = 27; psu_d  = 16;

/* ---------- lid details ---------- */
pipe_d = 2.0;                       // LED dot, on the TOP face
logo = "FULNEX";
logo_depth = 0.8;
crown_inset = 11;                   // how far the crown shoulder steps in
crown_rise = 3.4;                   // how much the crown rises
lidpost_xy = [[30, 30], [90, 30], [30, 90], [90, 90]];

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
      // relay module posts, beside the grommets
      for (x = [relay_x + 3, relay_x + relay_w - 3],
           y = [relay_y + 3, relay_y + relay_d - 3])
        post(x, y);
      // drop-in trays
      tray(buck_x, buck_y, buck_w, buck_d);
      tray(psu_x,  psu_y,  psu_w,  psu_d);
      // harness bridges along the front
      tiebar(34, 18);
      tiebar(62, 18);
      tiebar(84, 18);
    }

    // ---- front chord: 12 jacks, 3 rows of 4 ----
    x0 = W/2 - (jack_cols - 1) * jack_pitch / 2;
    for (c = [0 : jack_cols - 1], z = jack_rows_z)
      translate([x0 + c * jack_pitch, T + 1, z])
        rotate([90, 0, 0]) cylinder(d = jack_d, h = T + 4);

    // ---- rear chord: USB-C + grommets ----
    translate([usb_cx - usb_w/2, D - T - 1, usb_z - usb_h/2])
      cube([usb_w, T + 4, usb_h]);
    for (x = out_xs)
      translate([x, D - T - 1, out_z])
        rotate([-90, 0, 0]) cylinder(d = out_d, h = T + 4);

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
  bay_x = (pcb_w - dk_l) / 2;
  bay_y = (pcb_d - dk_w) / 2;
  difference() {
    cube([pcb_w, pcb_d, 2]);
    translate([bay_x + 7, bay_y - 1, -1]) cube([dk_l - 14, dk_w + 2, 4]);
    translate([bay_x - 1, bay_y + 7, -1]) cube([dk_l + 2, dk_w - 14, 4]);
    for (x = [5, pcb_w - 5], y = [5, pcb_d - 5])
      translate([x, y, -1]) cylinder(d = 3, h = 4);
    translate([6, pcb_d/2 - 6, -1]) cube([4, 12, 4]);
    translate([pcb_w - 10, pcb_d/2 - 6, -1]) cube([4, 12, 4]);
  }
  translate([bay_x, bay_y, 0]) deck_cradle();
  translate([bay_x + dk_l, bay_y, 0]) rotate([0, 0, 90]) deck_cradle();
  translate([bay_x + dk_l, bay_y + dk_w, 0]) rotate([0, 0, 180]) deck_cradle();
  translate([bay_x, bay_y + dk_w, 0]) rotate([0, 0, 270]) deck_cradle();
}

/* ============ layout ============ */
if (part == "base" || part == "both") base();
if (part == "lid")  lid();
if (part == "deck") deck();
if (part == "both") translate([W + 16, 0, Tlid + crown_rise]) rotate([0, 180, 0])
  translate([-W, 0, -Tlid]) lid();
