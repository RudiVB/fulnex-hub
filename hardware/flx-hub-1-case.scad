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
part = "both";        // "base" | "lid" | "both" (preview side by side)

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

/* ---------- PCB / devkit mounting ---------- */
pcb_w = 100; pcb_d = 70;                   // carrier board target size
standoff_h = 5;  standoff_d = 7;  screw_d = 2.6;   // M2.5 self-tap

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

/* ============ BASE ============ */
module base() {
  difference() {
    union() {
      // floor
      linear_extrude(Tf) squircle(W, D, R);
      // walls
      linear_extrude(H) shell2d();
      // PCB standoffs
      for (x = [(W-pcb_w)/2 + 5, (W+pcb_w)/2 - 5],
           y = [(D-pcb_d)/2 + 5, (D+pcb_d)/2 - 5])
        translate([x, y, Tf])
          difference() {
            cylinder(d = standoff_d, h = standoff_h);
            cylinder(d = screw_d,    h = standoff_h + 1);
          }
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

    // ---- right side: P10 level jack ----
    translate([W - T - 1, D/2, jack_z + jack_rowgap/2])
      rotate([0, 90, 0]) cylinder(d = p10_d, h = T + 2);

    // ---- rear: USB-C ----
    translate([W/2 - usb_w/2, D - T - 1, usb_z - usb_h/2])
      cube([usb_w, T + 2, usb_h]);

    // ---- rear: 3 output grommets (O1..O3), clear of the USB ----
    for (i = [0, 1, 2])
      translate([W/2 + 14 + i * out_pitch, D - T - 1, out_z])
        rotate([-90, 0, 0]) cylinder(d = out_d, h = T + 2);

    // ---- floor vents (under the relays / PSU zone) ----
    for (i = [0 : vent_n - 1])
      translate([W/2 - 42 + i * 12, D - 24, -1])
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

/* ============ layout ============ */
if (part == "base" || part == "both") base();
if (part == "lid")  lid();
if (part == "both") translate([W + 16, 0, Tlid]) rotate([0, 180, 0])
  translate([-W, 0, -Tlid]) lid();   // shown print-orientation (face down)
