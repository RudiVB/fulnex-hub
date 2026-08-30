// ============================================================
//  FLX-MOTION-1 pet visor (Olof's idea)
//  A tiny friction-fit collar for the motion puck's lens window:
//  the sleeve presses into the 13 mm opening around the PIR lens,
//  and the half-visor blocks the LOWER fresnel facets — twist it
//  visor-down and floor-level pets disappear from view. Twist it
//  away (or leave it off) for full coverage.
//
//  Print flat on the flange, no supports. PETG, 0.12 layers.
// ============================================================

sleeve_od = 12.7;     // presses into the shell's 13.0 window
sleeve_id = 10.6;     // clears the AM312 lens (~10)
sleeve_h  = 2.6;      // through the 2.0 shell + a little grip

flange_od = 16.5;
flange_t  = 1.2;

visor_len  = 6.0;     // how far the hood reaches past the lens
visor_wall = 1.5;

$fn = 96;

// flange against the dome
difference() {
  cylinder(d = flange_od, h = flange_t);
  translate([0, 0, -0.1]) cylinder(d = sleeve_id, h = flange_t + 0.2);
}
// insertion sleeve
translate([0, 0, flange_t])
  difference() {
    cylinder(d = sleeve_od, h = sleeve_h);
    translate([0, 0, -0.1]) cylinder(d = sleeve_id, h = sleeve_h + 0.2);
  }
// the visor: lower half-hood reaching forward over the lens
difference() {
  cylinder(d = flange_od, h = 0.01); // anchor for the hull below
  cylinder(d = 1, h = 1);
}
difference() {
  translate([0, 0, -visor_len]) cylinder(d = flange_od, h = visor_len);
  translate([0, 0, -visor_len - 0.1]) cylinder(d = flange_od - 2 * visor_wall, h = visor_len + 0.2);
  // keep only the lower half (visor side): cut the upper half away
  translate([-flange_od/2 - 1, 0, -visor_len - 1])
    cube([flange_od + 2, flange_od/2 + 2, visor_len + 2]);
}
// grip nub so fingers can twist the collar
translate([0, -flange_od/2 + 0.4, flange_t/2])
  sphere(d = 2.4);
