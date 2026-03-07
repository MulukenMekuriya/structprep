/**
 * Problem-type solution templates.
 * Step-by-step methodologies for each common PE exam problem type.
 * These are injected into the tutor prompt when teaching a topic.
 */

export interface SolutionTemplate {
  topic: string;
  subtopic: string;
  title: string;
  steps: string[];
  keyCodes: string[];
  commonMistakes: string[];
  timeEstimate: string;
}

export const SOLUTION_TEMPLATES: SolutionTemplate[] = [
  // ===== LOADS =====
  {
    topic: "loads_and_load_combinations",
    subtopic: "Wind Loads (MWFRS)",
    title: "Wind Pressure Calculation (Directional Procedure)",
    steps: [
      "Determine Risk Category (ASCE 7-16 Table 1.5-1) and basic wind speed V (Figures 26.5-1A/B/C/D)",
      "Determine exposure category (B, C, or D) per §26.7",
      "Calculate velocity pressure qz = 0.00256 × Kz × Kzt × Kd × Ke × V² (§26.10.2)",
      "Look up Kz from Table 26.10-1, Kzt from §26.8, Kd from Table 26.6-1, Ke from Table 26.9-1",
      "For MWFRS: p = q × G × Cp - qi(GCpi) per §27.3.1",
      "Get Cp from Figure 27.3-1 (walls) or Figure 27.3-2 (roofs)",
      "Get GCpi from Table 26.13-1 (±0.18 for enclosed buildings)",
      "Calculate pressures for windward, leeward, side walls, and roof",
    ],
    keyCodes: ["ASCE 7-16 §26.10.2", "ASCE 7-16 §27.3.1", "ASCE 7-16 Table 26.10-1", "ASCE 7-16 Figure 27.3-1"],
    commonMistakes: [
      "Forgetting the Ke (ground elevation factor) — it's new in ASCE 7-16",
      "Using the wrong Kz table (26.10-1 vs 26.10-2 for C&C)",
      "Not checking both +GCpi and -GCpi for internal pressure",
      "Using mean roof height h instead of z for windward wall pressure",
    ],
    timeEstimate: "8-12 min",
  },
  {
    topic: "loads_and_load_combinations",
    subtopic: "Seismic Loads (ELF)",
    title: "Equivalent Lateral Force Procedure",
    steps: [
      "Determine SS and S1 from USGS maps or ASCE 7-16 Figures 22-1/22-2",
      "Determine site class (A-F) from §11.4.2 or default to Site Class D",
      "Calculate SMS = Fa×SS, SM1 = Fv×S1 (Tables 11.4-1, 11.4-2)",
      "Calculate SDS = 2/3 × SMS, SD1 = 2/3 × SM1 (§11.4.4)",
      "Determine Seismic Design Category (SDC) from Tables 11.6-1/11.6-2",
      "Select seismic system and get R, Cd, Ω0 from Table 12.2-1",
      "Calculate Cs = SDS/(R/Ie) but not less than 0.044×SDS×Ie (§12.8.1.1)",
      "Check Cs ≥ 0.01 and Cs upper limit = SD1/(T×R/Ie) for T ≤ TL",
      "Calculate base shear V = Cs × W",
      "Distribute vertically: Fx = Cvx × V where Cvx = wx×hx^k / Σ(wi×hi^k)",
    ],
    keyCodes: ["ASCE 7-16 §12.8", "ASCE 7-16 Table 12.2-1", "ASCE 7-16 §11.4.4"],
    commonMistakes: [
      "Using Ss/S1 instead of SDS/SD1 (must apply site coefficients and 2/3 factor)",
      "Forgetting the minimum Cs = 0.044×SDS×Ie",
      "Using wrong Ie (Importance Factor) for the Risk Category",
      "Not checking both Tables 11.6-1 AND 11.6-2 for SDC (take the worse)",
    ],
    timeEstimate: "10-15 min",
  },
  {
    topic: "loads_and_load_combinations",
    subtopic: "Load Combinations",
    title: "LRFD Load Combination Selection",
    steps: [
      "List all applicable loads: D, L, Lr, S, R, W, E",
      "Write out all 7 LRFD combinations from ASCE 7-16 §2.3.1",
      "For each combination, plug in the actual load values",
      "Identify the controlling (maximum) combination",
      "For members resisting uplift/overturning, also check minimum combinations (0.9D + W, 0.9D + E)",
    ],
    keyCodes: ["ASCE 7-16 §2.3.1", "ASCE 7-16 §2.4.1"],
    commonMistakes: [
      "Forgetting the 0.5 factor on L when L < 100 psf in combination 3 and 4",
      "Not checking the uplift combinations (0.9D cases)",
      "Confusing Lr (roof live) with L (floor live)",
      "Not applying the load factor of 1.0 on E (it already includes ρ and 0.2SDS)",
    ],
    timeEstimate: "4-6 min",
  },

  // ===== CONCRETE =====
  {
    topic: "concrete_design",
    subtopic: "Beam Flexural Design",
    title: "RC Beam Flexural Strength (Mn)",
    steps: [
      "Calculate required Mu from factored loads",
      "Assume tension-controlled (φ = 0.90)",
      "Use rectangular stress block: a = As×fy / (0.85×f'c×b)",
      "Calculate Mn = As × fy × (d - a/2)",
      "Check φMn ≥ Mu",
      "Verify tension-controlled: c = a/β1, check εt = 0.003×(d-c)/c ≥ 0.005",
      "Check minimum steel: As,min = max(3√f'c/fy × bw×d, 200/fy × bw×d) per §9.6.1.2",
    ],
    keyCodes: ["ACI 318-14 §22.2", "ACI 318-14 §9.6.1.2", "ACI 318-14 Table 21.2.1"],
    commonMistakes: [
      "Forgetting to check tension-controlled assumption (εt ≥ 0.005)",
      "Using b (flange width) instead of bw (web width) for T-beams in negative moment",
      "Not checking minimum reinforcement",
      "Confusing a (stress block depth) with c (neutral axis depth)",
    ],
    timeEstimate: "5-8 min",
  },
  {
    topic: "concrete_design",
    subtopic: "Shear Design",
    title: "RC Beam Shear Design",
    steps: [
      "Calculate Vu at critical section (d from face of support for typical beams)",
      "Calculate Vc = 2×λ×√f'c × bw × d (simplified) per §22.5.5.1",
      "If Vu > φVc, stirrups are required",
      "Required Vs = Vu/φ - Vc",
      "Calculate stirrup spacing: s = Av×fyt×d / Vs",
      "Check max spacing: s ≤ d/2 when Vs ≤ 4√f'c×bw×d, else s ≤ d/4",
      "Check Vs ≤ 8√f'c × bw × d (if exceeded, increase section)",
      "Check minimum Av/s = max(0.75√f'c × bw/fyt, 50bw/fyt)",
    ],
    keyCodes: ["ACI 318-14 §22.5", "ACI 318-14 §9.7.6.2.2"],
    commonMistakes: [
      "Taking Vu at center of support instead of at d from face",
      "Forgetting λ factor for lightweight concrete",
      "Not checking maximum stirrup spacing limits",
      "Using fy instead of fyt for stirrup yield strength",
    ],
    timeEstimate: "5-8 min",
  },
  {
    topic: "concrete_design",
    subtopic: "Column Design",
    title: "RC Column Interaction (Axial + Bending)",
    steps: [
      "Determine Pu and Mu from factored loads",
      "Select column size and reinforcement layout",
      "Calculate key points on interaction diagram: Pure axial (P0), balanced point, pure moment",
      "For tied columns: φPn,max = 0.80×φ×P0 where φ = 0.65",
      "For spiral columns: φPn,max = 0.85×φ×P0 where φ = 0.75",
      "Check slenderness: klu/r. If > 22 (non-sway) or > 22 (sway), magnify moments per §6.2.5/§6.2.6",
      "Verify (Pu, Mu) falls inside the interaction diagram",
    ],
    keyCodes: ["ACI 318-14 §22.4", "ACI 318-14 §6.2.5", "ACI 318-14 §6.2.6"],
    commonMistakes: [
      "Forgetting the 0.80/0.85 reduction on max axial capacity",
      "Using wrong φ factor (0.65 tied vs 0.75 spiral)",
      "Ignoring slenderness effects when klu/r exceeds limits",
      "Not applying minimum eccentricity",
    ],
    timeEstimate: "8-12 min",
  },

  // ===== STEEL =====
  {
    topic: "steel_design",
    subtopic: "Beam Design (Flexure)",
    title: "Steel Beam Flexural Strength",
    steps: [
      "Determine required Mu or Ma from factored/service loads",
      "Select trial W-shape from AISC Manual",
      "Classify section: check flange and web compactness per Table B4.1b",
      "Determine unbraced length Lb",
      "Calculate Lp = 1.76ry√(E/Fy) and Lr per §F2.2",
      "If Lb ≤ Lp: Mn = Mp = Fy×Zx (yielding controls)",
      "If Lp < Lb ≤ Lr: Linear interpolation between Mp and 0.7Fy×Sx",
      "If Lb > Lr: Elastic LTB per Eq. F2-4",
      "Apply Cb factor for non-uniform moment (Eq. F1-1)",
      "Check φbMn ≥ Mu (LRFD, φb = 0.90)",
    ],
    keyCodes: ["AISC 360-16 §F2", "AISC 360-16 Table B4.1b", "AISC 360-16 Eq. F1-1"],
    commonMistakes: [
      "Using Sx (elastic) instead of Zx (plastic) section modulus for compact sections",
      "Not applying Cb (conservative Cb = 1.0 but leaving points on the table)",
      "Confusing Lb (unbraced length) with total span length",
      "Not checking web compactness for flexure",
    ],
    timeEstimate: "5-8 min",
  },
  {
    topic: "steel_design",
    subtopic: "Column Design",
    title: "Steel Column Compressive Strength",
    steps: [
      "Determine required Pu from factored loads",
      "Determine effective length KL for each axis",
      "Calculate KL/r for both axes, use the LARGER value",
      "Compare KL/r to 4.71√(E/Fy) = 113.4 for Fy=50 ksi",
      "If KL/r ≤ 4.71√(E/Fy): Fcr = (0.658^(Fy/Fe)) × Fy (inelastic buckling)",
      "If KL/r > 4.71√(E/Fy): Fcr = 0.877 × Fe (elastic buckling)",
      "Fe = π²E / (KL/r)²",
      "Pn = Fcr × Ag",
      "Check φcPn ≥ Pu (LRFD, φc = 0.90)",
    ],
    keyCodes: ["AISC 360-16 §E3", "AISC 360-16 Table 4-14 (Manual)"],
    commonMistakes: [
      "Using wrong K factor (K=1.0 is only for pinned-pinned, actual K depends on end conditions)",
      "Not checking BOTH axes and using the governing (larger) KL/r",
      "Using Fy instead of Fe in the comparison",
      "Forgetting to check local buckling (element slenderness) per Table B4.1a",
    ],
    timeEstimate: "5-8 min",
  },
  {
    topic: "steel_design",
    subtopic: "Bolted Connections",
    title: "Bolt Group Design",
    steps: [
      "Determine required force (shear, tension, or combined)",
      "Select bolt type (A325 or A490) and diameter",
      "Determine if slip-critical or bearing-type",
      "Get nominal bolt strength from Table J3.2",
      "For shear: Rn = Fnv × Ab per bolt. Check single vs double shear",
      "For bearing: Rn = 2.4dtFu per bolt (deformation permitted) or 3.0dtFu",
      "For tearout: Rn = 1.2LctFu per bolt",
      "Use controlling value (minimum of shear, bearing, tearout) per bolt",
      "Required bolts n = Pu / (φRn per bolt), φ = 0.75",
      "Check bolt spacing ≥ 2.667d, edge distance per Table J3.4",
    ],
    keyCodes: ["AISC 360-16 §J3", "AISC 360-16 Table J3.2", "AISC 360-16 Table J3.4"],
    commonMistakes: [
      "Using X-type (threads excluded) strength when threads ARE in the shear plane (N-type)",
      "Forgetting to check tearout (especially for edge bolts)",
      "Not reducing bearing strength for bolt holes (standard vs oversized)",
      "Confusing Fnv (bolt shear stress) with Fv (applied shear force)",
    ],
    timeEstimate: "6-10 min",
  },

  // ===== WOOD =====
  {
    topic: "wood_design",
    subtopic: "Beam Design",
    title: "Wood Beam Bending Design",
    steps: [
      "Get reference design value Fb from NDS Supplement (Table 4A for dimension lumber, 5A for timbers)",
      "Apply ALL adjustment factors: F'b = Fb × CD × CM × Ct × CL × CF × Cfu × Ci × Cr",
      "CD: load duration factor (Table 2.3.2 — 1.6 for wind, 1.25 for snow, 0.9 for permanent)",
      "CM: wet service factor (Table 4A footnote)",
      "CL: beam stability factor (§3.3.3)",
      "CF: size factor (Table 4A for dimension lumber)",
      "Calculate required section modulus: Sreq = M / F'b",
      "Select section and check Sactual ≥ Sreq",
      "Check shear: F'v = Fv × CD × CM × Ct × Ci, then fv = 3V/(2bd) ≤ F'v",
      "Check deflection: Δ = 5wL⁴/(384EI) ≤ L/360 (or applicable limit)",
    ],
    keyCodes: ["NDS 2018 §3.3", "NDS Supplement Table 4A", "NDS 2018 Table 2.3.2"],
    commonMistakes: [
      "Forgetting the CD factor or using the wrong value for the load type",
      "Not applying CL (beam stability) when compression edge is not braced",
      "Confusing CF (size factor) with CL (stability factor)",
      "Using E instead of E'min for stability calculations",
    ],
    timeEstimate: "6-10 min",
  },

  // ===== MASONRY =====
  {
    topic: "masonry_design",
    subtopic: "Shear Wall Design",
    title: "CMU Shear Wall (Strength Design)",
    steps: [
      "Determine factored loads: Vu (in-plane shear) and Mu (in-plane moment)",
      "Calculate Vn = Vnm + Vns per TMS 402 §9.3.4.1.2",
      "Vnm (masonry contribution) depends on M/(Vd) ratio",
      "Vns = 0.5(Av/s)fyd for horizontal reinforcement",
      "Check φVn ≥ Vu (φ = 0.80 for shear)",
      "For flexure: design vertical reinforcement for Mu",
      "Check maximum reinforcement limits per §9.3.3.5",
      "Check axial + flexure interaction",
    ],
    keyCodes: ["TMS 402/602 §9.3", "TMS 402/602 §9.3.4.1.2"],
    commonMistakes: [
      "Using wrong M/(Vd) ratio for Vnm calculation",
      "Forgetting to check maximum reinforcement limits",
      "Not including axial load effects on shear capacity",
      "Using wrong d value (to centroid of tension steel, not wall thickness)",
    ],
    timeEstimate: "8-12 min",
  },
];

/**
 * Get solution templates for a given topic keyword.
 */
export function getTemplatesForTopic(topicKeyword: string): SolutionTemplate[] {
  const kw = topicKeyword.toLowerCase();
  return SOLUTION_TEMPLATES.filter(
    (t) =>
      t.topic.toLowerCase().includes(kw) ||
      t.subtopic.toLowerCase().includes(kw) ||
      t.title.toLowerCase().includes(kw)
  );
}
