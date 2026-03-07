/**
 * Code Navigation Speed Trainer — section lookup challenges.
 * User must find the given section in their physical code book.
 */

export interface CodeNavChallenge {
  id: string;
  code: string;
  section: string;
  description: string;
  hint: string;
  targetTimeSec: number; // goal time in seconds
}

export const CODE_NAV_CHALLENGES: CodeNavChallenge[] = [
  // ASCE 7
  { id: "cn-1", code: "ASCE 7-16", section: "Table 4.3-1", description: "Minimum uniformly distributed live loads", hint: "Chapter 4 — Live Loads", targetTimeSec: 45 },
  { id: "cn-2", code: "ASCE 7-16", section: "§2.3.1", description: "LRFD load combinations", hint: "Chapter 2 — Combinations", targetTimeSec: 30 },
  { id: "cn-3", code: "ASCE 7-16", section: "§12.8.1", description: "Seismic base shear equation", hint: "Chapter 12 — Seismic ELF", targetTimeSec: 45 },
  { id: "cn-4", code: "ASCE 7-16", section: "Figure 26.5-1B", description: "Basic wind speed map (Risk Cat II)", hint: "Chapter 26 — Wind Provisions", targetTimeSec: 60 },
  { id: "cn-5", code: "ASCE 7-16", section: "Table 12.12-1", description: "Allowable story drift limits", hint: "Chapter 12 — Seismic Drift", targetTimeSec: 50 },
  { id: "cn-6", code: "ASCE 7-16", section: "Table 12.2-1", description: "Design coefficients (R, Cd, Ω0) for seismic systems", hint: "Chapter 12 — Seismic Tables", targetTimeSec: 45 },
  { id: "cn-7", code: "ASCE 7-16", section: "§7.3", description: "Flat roof snow load equation", hint: "Chapter 7 — Snow", targetTimeSec: 45 },
  { id: "cn-8", code: "ASCE 7-16", section: "Figure 28.3-1", description: "MWFRS pressure coefficients (low-rise)", hint: "Chapter 28 — Wind MWFRS", targetTimeSec: 60 },
  { id: "cn-9", code: "ASCE 7-16", section: "Table 26.11-1", description: "Directional wind pressure formula parameters", hint: "Chapter 26 — Wind", targetTimeSec: 60 },
  { id: "cn-10", code: "ASCE 7-16", section: "§11.4.4", description: "Design spectral acceleration SDS and SD1", hint: "Chapter 11 — Seismic Ground Motion", targetTimeSec: 50 },

  // ACI 318
  { id: "cn-11", code: "ACI 318-14", section: "§22.2.2", description: "Rectangular stress block for flexure", hint: "Chapter 22 — Sectional Strength", targetTimeSec: 50 },
  { id: "cn-12", code: "ACI 318-14", section: "Table 21.2.1", description: "Strength reduction factors (φ)", hint: "Chapter 21 — Strength Reduction", targetTimeSec: 40 },
  { id: "cn-13", code: "ACI 318-14", section: "§25.4.2", description: "Development length of deformed bars", hint: "Chapter 25 — Reinforcement Details", targetTimeSec: 55 },
  { id: "cn-14", code: "ACI 318-14", section: "§22.5.5", description: "Shear strength provided by concrete (Vc)", hint: "Chapter 22 — Shear", targetTimeSec: 50 },
  { id: "cn-15", code: "ACI 318-14", section: "§22.6", description: "Two-way shear (punching) provisions", hint: "Chapter 22 — Two-Way Shear", targetTimeSec: 55 },
  { id: "cn-16", code: "ACI 318-14", section: "Table 9.3.1.1", description: "Minimum slab thickness for deflection control", hint: "Chapter 9 — Beams", targetTimeSec: 50 },
  { id: "cn-17", code: "ACI 318-14", section: "Chapter 17", description: "Anchoring to concrete provisions", hint: "Look for Anchoring/Anchor Design", targetTimeSec: 60 },

  // AISC 360
  { id: "cn-18", code: "AISC 360-16", section: "§F2", description: "Flexural strength of doubly-symmetric I-shapes", hint: "Chapter F — Flexure", targetTimeSec: 40 },
  { id: "cn-19", code: "AISC 360-16", section: "Table J3.2", description: "Nominal bolt strengths", hint: "Chapter J — Connections", targetTimeSec: 45 },
  { id: "cn-20", code: "AISC 360-16", section: "§E3", description: "Compressive strength for flexural buckling", hint: "Chapter E — Compression", targetTimeSec: 45 },
  { id: "cn-21", code: "AISC 360-16", section: "Table B4.1b", description: "Width-to-thickness ratio limits (flexure)", hint: "Chapter B — Design Requirements", targetTimeSec: 55 },
  { id: "cn-22", code: "AISC 360-16", section: "§G2", description: "Shear strength of I-shaped members", hint: "Chapter G — Shear", targetTimeSec: 45 },
  { id: "cn-23", code: "AISC 360-16", section: "§J2.4", description: "Fillet weld design strength", hint: "Chapter J — Welds", targetTimeSec: 50 },
  { id: "cn-24", code: "AISC 360-16", section: "§D2", description: "Tensile yielding on gross section", hint: "Chapter D — Tension", targetTimeSec: 40 },
  { id: "cn-25", code: "AISC 360-16", section: "Eq. F1-1", description: "Lateral-torsional buckling Cb factor", hint: "Chapter F — Flexure", targetTimeSec: 50 },

  // NDS
  { id: "cn-26", code: "NDS 2018", section: "Table 4A (Supplement)", description: "Reference design values for visually graded dimension lumber", hint: "NDS Supplement — Design Values", targetTimeSec: 60 },
  { id: "cn-27", code: "NDS 2018", section: "§3.7.1", description: "Column stability factor (CP)", hint: "Chapter 3 — Design Provisions", targetTimeSec: 55 },
  { id: "cn-28", code: "NDS 2018", section: "§12.3", description: "Bolted connection design", hint: "Chapter 12 — Connections", targetTimeSec: 55 },

  // IBC
  { id: "cn-29", code: "IBC 2018", section: "Table 1604.3", description: "Deflection limits", hint: "Chapter 16 — Structural Design", targetTimeSec: 45 },
  { id: "cn-30", code: "IBC 2018", section: "Table 601", description: "Fire-resistance rating requirements by construction type", hint: "Chapter 6 — Types of Construction", targetTimeSec: 50 },

  // TMS
  { id: "cn-31", code: "TMS 402/602", section: "§9.3", description: "Strength design of reinforced masonry", hint: "Chapter 9 — Strength Design", targetTimeSec: 65 },
];
