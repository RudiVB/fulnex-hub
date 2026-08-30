// FULNEX logotype candidates — pick one
use <fulnex-logo.scad>;

// A: the blocky drawn mark (current)
translate([0, 40, 0]) linear_extrude(1) fulnex_logo(10, slit = true);

// B: the same geometry ROUNDED — soft modular, Nothing-style
translate([0, 20, 0]) linear_extrude(1)
  offset(r = 0.9) offset(r = -0.9)
    offset(r = 0.55) scale([1, 1]) fulnex_logo(10, slit = true);

// C: rounded, no slit, wider strokes read friendlier
translate([0, 0, 0]) linear_extrude(1)
  offset(r = 0.8) offset(delta = -0.35) fulnex_logo(10, slit = false);

// D: Michroma reference
translate([0, -20, 0]) linear_extrude(1)
  text("FULNEX", size = 8.5, font = "Michroma",
       halign = "center", valign = "center", spacing = 1.6);
