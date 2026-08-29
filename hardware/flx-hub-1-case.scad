// ============================================================
//  FLX-HUB-1 — Rev A enclosure (parametric)
//  FULNEX · matte black PETG · lid printed logo-face-down on PEI
//
//  Assembly line (Olof):
//    1. print base + lid (no supports needed)
//    2. press 12 panel-mount 3.5mm jacks into the front row,
//       1 four-pole jack (P10) — nuts inside
//    3. drop the board onto the standoffs, 4 screws
//    4. route output cables through the 3 rear grommets
//    5. clear filament stub into the light-pipe hole
//    6. lid on (4 screws), QR label into the base recess — done
//
//  Render:  F5 preview · F6 render · export STL per part below
// ============================================================

/* ---------- what to render ---------- */
part = "both";        // "base" | "lid" | "deck" | "both"

/* ---------- master dimensions (mm) ---------- */
W  = 128;             // outer width  (front = jack face)
D  = 92;              // outer depth
H  = 34;              // outer height (base walls; lid adds Tlid)
R  = 10;              // corner radius (squircle)
T  = 2.4;             // wall thickness
Tf = 2.8;             // floor thickness
Tlid = 3.0;           // lid thickness

/* ---------- jacks: 12 sense on the front face ---------- */
jack_d      = 6.4;    // panel-mount 3.5mm jack barrel hole
jack_rows   = 2;
jack_cols   = 6;
jack_pitch  = 16;     // horizontal spacing
jack_rowgap = 13;     // vertical spacing between the two rows
jack_z      = 12;     // centre height of the LOWER row above outer floor

/* ---------- P10 level jack (4-pole) on the right side ---------- */
p10_d = 6.4;

/* ---------- rear: USB-C + 3 output grommets ---------- */
usb_w = 10;  usb_h = 4.4;  usb_z = 8;      // USB-C cutout centre height
out_d = 8.2;                               // output cable grommet holes
out_pitch = 18;
out_z = 12;

/* ---------- interior fit-out (drop-in assembly) ----------
   Zones, seen from above with the jack face at the bottom:
     front strip  — wiring harness lane with zip-tie bridges
     left-centre  — main board (protoboard now, carrier PCB later)
     right column — 3-relay module on posts, next to the grommets
     rear-left    — buck converter tray (drop in, lid holds it)
     rear-centre  — USB-C power module tray behind the USB cutout
------------------------------------------------------------- */
pcb_w = 70;  pcb_d = 50;                   // main board zone
pcb_x = 15;  pcb_y = 25;                   // its lower-left corner
standoff_h = 5;  standoff_d = 7;  screw_d = 2.6;   // M2.5 self-tap
relay_x = 96; relay_y = 26;                // relay module zone (26 x 48)
relay_w = 26; relay_d = 48;
buck_x = 14;  buck_y = 70;  buck_w = 26; buck_d = 18;   // buck tray
psu_x  = 51;  psu_y  = 72;  psu_w  = 27; psu_d  = 16;   // USB-C module tray

/* ---------- details ---------- */
pipe_d   = 2.0;       // status LED light-pipe hole in the lid
label_w  = 34;        // QR label recess on the underside
label_h  = 34;
label_t  = 0.6;
logo     = "FULNEX";
logo_depth = 1.0;     // deboss into lid top (prints face-down = crisp)
vent_n   = 8;

$fn = 48;

/* ============ helpers ============ */
module squircle(w, d, r) {
  hull() for (x = [r, w - r], y = [r, d - r]) translate([x, y]) circle(r);
}
module shell2d() {
  difference() { squircle(W, D, R); offset(-T) squircle(W, D, R); }
}
// screw post for a module corner
module post(x, y, h = 4, d = 6, hole = 2.2) {
  translate([x, y, Tf]) difference() {
    cylinder(d = d, h = h);
    cylinder(d = hole, h = h + 1);
  }
}
// drop-in tray: 3-sided fence, open toward the front; the lid's
// inner lip stops anything jumping out
module tray(x, y, w, d, wall = 1.6, h = 3.2) {
  translate([x, y, Tf]) difference() {
    cube([w, d, h]);
    translate([wall, -1, -1]) cube([w - 2 * wall, d - wall + 1, h + 2]);
  }
}
// zip-tie bridge for the jack wiring harness
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
      // floor
      linear_extrude(Tf) squircle(W, D, R);
      // walls
      linear_extrude(H) shell2d();
      // main board standoffs (protoboard now, carrier PCB later)
      for (x = [pcb_x + 5, pcb_x + pcb_w - 5],
           y = [pcb_y + 5, pcb_y + pcb_d - 5])
        translate([x, y, Tf])
          difference() {
            cylinder(d = standoff_d, h = standoff_h);
            cylinder(d = screw_d,    h = standoff_h + 1);
          }
      // relay module posts — right column, beside the grommets
      for (x = [relay_x + 3, relay_x + relay_w - 3],
           y = [relay_y + 3, relay_y + relay_d - 3])
        post(x, y);
      // drop-in trays: buck converter (rear-left) and the USB-C
      // power module directly behind its cutout
      tray(buck_x, buck_y, buck_w, buck_d);
      tray(psu_x,  psu_y,  psu_w,  psu_d);
      // zip-tie bridges for the 12-jack harness, along the front
      tiebar(30, 16);
      tiebar(62, 16);
      tiebar(94, 16);
      // lid screw posts in the corners
      for (x = [R, W - R], y = [R, D - R])
        translate([x, y, Tf])
          difference() {
            cylinder(d = 8, h = H - Tf);
            translate([0, 0, H - Tf - 8]) cylinder(d = screw_d, h = 9);
          }
    }

    // ---- front face: 12 sense jacks in 2 rows of 6 ----
    x0 = W/2 - (jack_cols - 1) * jack_pitch / 2;
    for (c = [0 : jack_cols - 1], r = [0 : jack_rows - 1])
      translate([x0 + c * jack_pitch, T + 1, jack_z + r * jack_rowgap])
        rotate([90, 0, 0]) cylinder(d = jack_d, h = T + 2);

    // (P10 is the top-right hole of the front grid — a 4-pole jack
    //  in the same Ø6.4 barrel; no side-wall hole needed)

    // ---- rear: USB-C ----
    translate([W/2 - usb_w/2, D - T - 1, usb_z - usb_h/2])
      cube([usb_w, T + 2, usb_h]);

    // ---- rear: 3 output grommets (O1..O3), clear of the USB ----
    for (i = [0, 1, 2])
      translate([W/2 + 14 + i * out_pitch, D - T - 1, out_z])
        rotate([-90, 0, 0]) cylinder(d = out_d, h = T + 2);

    // ---- floor vents (under the main board, clear of the trays) ----
    for (i = [0 : vent_n - 1])
      translate([20 + i * 12, 40, -1])
        linear_extrude(Tf + 2) squircle(3, 12, 1.4);

    // ---- QR label recess, underside ----
    translate([W/2 - label_w/2, D/2 - label_h/2, -0.01])
      cube([label_w, label_h, label_t]);
  }

  // base inscription beside the label recess (reads correct from below)
  translate([W/2, D/2 - label_h/2 - 5, label_t])
    rotate([180, 0, 0])
      linear_extrude(0.5)
        text("FLX-HUB-1  ·  REV A", size = 3.4,
             font = "Arial:style=Bold", halign = "center");
}

/* ============ LID ============ */
// Print upside-down (top face on the plate) for a crisp deboss.
module lid() {
  difference() {
    union() {
      linear_extrude(Tlid) squircle(W, D, R);
      // inner lip that seats inside the walls
      translate([0, 0, -3])
        linear_extrude(3)
          difference() {
            offset(-T - 0.25) squircle(W, D, R);
            offset(-T - 2.25) squircle(W, D, R);
          }
    }
    // FULNEX deboss
    translate([W/2, D/2, Tlid - logo_depth])
      linear_extrude(logo_depth + 0.1)
        text(logo, size = 11, font = "Arial:style=Bold",
             halign = "center", valign = "center", spacing = 1.35);
    // status LED light pipe — top-right, matches the app icon
    translate([W - 22, D - 20, -4]) cylinder(d = pipe_d, h = Tlid + 8);
    // corner screw holes (countersunk)
    for (x = [R, W - R], y = [R, D - R]) {
      translate([x, y, -4]) cylinder(d = screw_d + 0.4, h = Tlid + 8);
      translate([x, y, Tlid - 1.4]) cylinder(d1 = screw_d + 0.4, d2 = 6, h = 1.5);
    }
  }
}

/* ============ DECK ============ */
// The part the ESP32 actually lives in: a carrier plate that snaps
// around a DevKit V1 and screws onto the base's four standoffs.
// Pin headers hang through the opening; the board corners rest on
// tabs and click under four small lips — no screws touch the ESP.
// When the carrier PCB exists, it replaces this deck 1:1.
dk_l = 49.5;          // DevKit V1 length (+0.5 tolerance)
dk_w = 29.0;          // DevKit V1 width  (+0.4 tolerance)

module deck_cradle() {           // L-wall + lip at one board corner
  // walls outside the corner
  translate([-2, -2, 2]) cube([10, 2, 3]);
  translate([-2, -2, 2]) cube([2, 10, 3]);
  // lips: hang 0.9 mm over the board top (board sits at z2..3.6)
  translate([0, -0.1, 3.9]) cube([5, 1, 1]);
  translate([-0.1, 0, 3.9]) cube([1, 5, 1]);
}

module deck() {
  bay_x = (pcb_w - dk_l) / 2;
  bay_y = (pcb_d - dk_w) / 2;
  difference() {
    cube([pcb_w, pcb_d, 2]);
    // header opening — the crossing cutouts leave four corner tabs
    translate([bay_x + 7, bay_y - 1, -1]) cube([dk_l - 14, dk_w + 2, 4]);
    translate([bay_x - 1, bay_y + 7, -1]) cube([dk_l + 2, dk_w - 14, 4]);
    // screw holes down to the base standoffs (M2.5)
    for (x = [5, pcb_w - 5], y = [5, pcb_d - 5])
      translate([x, y, -1]) cylinder(d = 3, h = 4);
    // harness pass-through slots
    translate([6, pcb_d/2 - 6, -1]) cube([4, 12, 4]);
    translate([pcb_w - 10, pcb_d/2 - 6, -1]) cube([4, 12, 4]);
  }
  // four corner cradles, rotated around the bay
  translate([bay_x, bay_y, 0]) deck_cradle();
  translate([bay_x + dk_l, bay_y, 0]) rotate([0, 0, 90]) deck_cradle();
  translate([bay_x + dk_l, bay_y + dk_w, 0]) rotate([0, 0, 180]) deck_cradle();
  translate([bay_x, bay_y + dk_w, 0]) rotate([0, 0, 270]) deck_cradle();
}

/* ============ layout ============ */
if (part == "base" || part == "both") base();
if (part == "lid")  lid();
if (part == "deck") deck();
if (part == "both") translate([W + 16, 0, Tlid]) rotate([0, 180, 0])
  translate([-W, 0, -Tlid]) lid();   // shown print-orientation (face down)
