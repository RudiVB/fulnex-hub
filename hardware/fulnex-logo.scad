// ============================================================
//  FULNEX logotype — v3, traced from the approved mark
//  Rounded techno sans: F with a curved elbow, U with a full
//  semicircular bowl, L, N drawn as an arch (the U flipped),
//  E with its spine on the right (the mirrored Ǝ of the mark),
//  X as two diagonals meeting in a small hub that carries the
//  LED light pipe — the X holds the light.
//
//  fulnex_logo(h)   — 2D, centered on origin, h = cap height
//  fulnex_eye_x(h)  — x offset from logo center to the X hub
// ============================================================

$fn = 64;
t = 2.2;            // stroke weight on the 10-unit grid
Rz = 2.8;           // elbow radius (F, L corners)
Re = 1.2;           // near-square elbows on the E so it never reads as a 3

function fulnex_eye_x(h) = 2.39 * h;

// quarter of an annular ring, first quadrant (0..90 deg)
module _fl_arc(R) {
  intersection() {
    difference() { circle(R); circle(R - t); }
    square(R + 0.1);
  }
}

module _fl_F() {              // width 7.0
  square([t, 10 - Rz]);
  translate([Rz, 10 - Rz]) rotate(90) _fl_arc(Rz);
  translate([Rz, 10 - t]) square([7.0 - Rz, t]);
  translate([0, 4.5]) square([5.2, t]);
}

module _fl_U(w = 7.4) {       // full semicircular bowl
  r = w / 2;
  difference() {
    union() {
      translate([0, r]) square([w, 10 - r]);
      translate([r, r]) circle(r);
    }
    translate([t, r]) square([w - 2 * t, 10 - r + 1]);
    translate([r, r]) circle(r - t);
  }
}

module _fl_L() {              // width 6.2
  translate([0, Rz]) square([t, 10 - Rz]);
  translate([Rz, Rz]) rotate(180) _fl_arc(Rz);
  translate([Rz, 0]) square([6.2 - Rz, t]);
}

module _fl_N() {              // the arch: the U flipped on its head
  translate([0, 10]) mirror([0, 1]) _fl_U(7.4);
}

module _fl_E_arc(R) {         // quarter ring with the tighter radius
  intersection() {
    difference() { circle(R); circle(R - t); }
    square(R + 0.1);
  }
}

module _fl_E() {              // width 6.8, spine on the RIGHT (as approved)
  translate([6.8 - t, Re]) square([t, 10 - 2 * Re]);
  translate([6.8 - Re, 10 - Re]) _fl_E_arc(Re);
  translate([0, 10 - t]) square([6.8 - Re, t]);
  translate([6.8 - Re, Re]) rotate(270) _fl_E_arc(Re);
  square([6.8 - Re, t]);
  translate([1.4, 4.5]) square([5.4, t]);
}

module _fl_stroke(a, b) {     // rounded-end bar from a to b
  hull() {
    translate(a) circle(t / 2);
    translate(b) circle(t / 2);
  }
}

module _fl_X() {              // width 7.6, hub at (3.8, 5)
  difference() {
    union() {
      _fl_stroke([1.15, 1.1], [6.45, 8.9]);
      _fl_stroke([6.45, 1.1], [1.15, 8.9]);
      translate([3.8, 5]) circle(2.2);
    }
    translate([3.8, 5]) circle(1.1);   // the eye — LED pipe lands here
  }
}

module fulnex_logo(h = 10, slit = false) {
  scale(h / 10) translate([-27.7, -5]) {
    // close: round the inner elbows / open: soften the terminals
    offset(-0.35) offset(0.35)
    offset(0.55) offset(-0.55)
    union() {
      _fl_F();
      translate([9.6, 0]) _fl_U();
      translate([19.6, 0]) _fl_L();
      translate([28.4, 0]) _fl_N();
      translate([38.4, 0]) _fl_E();
      translate([47.8, 0]) _fl_X();
    }
  }
}

// preview
fulnex_logo(10);
