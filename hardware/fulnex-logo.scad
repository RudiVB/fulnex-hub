// ============================================================
//  The FULNEX logotype — drawn, not typed.
//  Blocky geometric letterforms built from rectangles and
//  diagonals, in the spirit of the approved renders. At large
//  sizes the family's parting SLIT cuts straight through the
//  letters — the logo carries the same line as the products.
//
//  use <fulnex-logo.scad>;
//  linear_extrude(0.7) fulnex_logo(h = 11);   // centred, 2D
//
//  Width = 5.7 × h. The slit appears automatically at h >= 10
//  (below that the stencil gap would be too fine to print).
// ============================================================

module _fl_F() {
  square([2.2, 10]);
  translate([0, 7.8]) square([7, 2.2]);
  translate([0, 4.1]) square([5.6, 2.2]);
}
module _fl_U() {
  square([2.2, 10]);
  translate([4.8, 0]) square([2.2, 10]);
  square([7, 2.2]);
}
module _fl_L() {
  square([2.2, 10]);
  square([7, 2.2]);
}
module _fl_N() {
  square([2.2, 10]);
  translate([4.8, 0]) square([2.2, 10]);
  polygon([[0, 10], [2.2, 10], [7, 0], [4.8, 0]]);
}
module _fl_E() {
  square([2.2, 10]);
  translate([0, 7.8]) square([7, 2.2]);
  translate([0, 3.9]) square([5.6, 2.2]);
  square([7, 2.2]);
}
module _fl_X() {
  polygon([[0, 0], [2.2, 0], [7, 10], [4.8, 10]]);
  polygon([[4.8, 0], [7, 0], [2.2, 10], [0, 10]]);
}

// centred at the origin; h in mm. The mark: rounded modular
// letterforms — soft, chunky, unmistakable — with the family's
// slit cut through at large sizes.
module fulnex_logo(h = 10, slit = undef) {
  s = h / 10;
  cut = (slit == undef) ? (h >= 10) : slit;
  scale([s, s])
    translate([-28.5, -5])
      difference() {
        offset(r = 0.9) offset(r = -0.9) offset(r = 0.55)
          union() {
            _fl_F();
            translate([10, 0]) _fl_U();
            translate([20, 0]) _fl_L();
            translate([30, 0]) _fl_N();
            translate([40, 0]) _fl_E();
            translate([50, 0]) _fl_X();
          }
        if (cut) translate([-2, 3.0]) square([61, 0.8]);
      }
}
