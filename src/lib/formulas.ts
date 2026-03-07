export interface Formula {
  name: string;
  latex: string;
  description: string;
  reference: string;
  variables?: string;
}

export interface FormulaCategory {
  title: string;
  formulas: Formula[];
}

export const FORMULA_SHEETS: Record<string, FormulaCategory[]> = {
  loads_and_load_applications: [
    {
      title: "LRFD Load Combinations (ASCE 7-16 §2.3.1)",
      formulas: [
        { name: "LC1", latex: "1.4D", description: "Dead load only", reference: "ASCE 7-16 §2.3.1" },
        { name: "LC2", latex: "1.2D + 1.6L + 0.5(L_r \\text{ or } S \\text{ or } R)", description: "Dead + live + roof", reference: "ASCE 7-16 §2.3.1" },
        { name: "LC3", latex: "1.2D + 1.6(L_r \\text{ or } S \\text{ or } R) + (L \\text{ or } 0.5W)", description: "Dead + roof + live or wind", reference: "ASCE 7-16 §2.3.1" },
        { name: "LC4", latex: "1.2D + 1.0W + L + 0.5(L_r \\text{ or } S \\text{ or } R)", description: "Dead + wind + live + roof", reference: "ASCE 7-16 §2.3.1" },
        { name: "LC5", latex: "1.2D + 1.0E + L + 0.2S", description: "Dead + seismic + live + snow", reference: "ASCE 7-16 §2.3.1" },
        { name: "LC6", latex: "0.9D + 1.0W", description: "Dead + wind (uplift)", reference: "ASCE 7-16 §2.3.1" },
        { name: "LC7", latex: "0.9D + 1.0E", description: "Dead + seismic (uplift)", reference: "ASCE 7-16 §2.3.1" },
      ],
    },
    {
      title: "ASD Load Combinations (ASCE 7-16 §2.4.1)",
      formulas: [
        { name: "ASD1", latex: "D", description: "Dead load only", reference: "ASCE 7-16 §2.4.1" },
        { name: "ASD2", latex: "D + L", description: "Dead + live", reference: "ASCE 7-16 §2.4.1" },
        { name: "ASD3", latex: "D + (L_r \\text{ or } S \\text{ or } R)", description: "Dead + roof loads", reference: "ASCE 7-16 §2.4.1" },
        { name: "ASD5", latex: "D + 0.6W", description: "Dead + wind", reference: "ASCE 7-16 §2.4.1" },
        { name: "ASD6", latex: "D + 0.75L + 0.75(0.6W) + 0.75(L_r \\text{ or } S \\text{ or } R)", description: "Combined", reference: "ASCE 7-16 §2.4.1" },
      ],
    },
    {
      title: "Wind Loads (ASCE 7-16 Chapter 27)",
      formulas: [
        { name: "Velocity Pressure", latex: "q_z = 0.00256 K_z K_{zt} K_d K_e V^2", description: "Velocity pressure at height z", reference: "ASCE 7-16 §27.3.2", variables: "$K_z$ = velocity pressure exposure coeff, $K_{zt}$ = topographic factor, $K_d$ = wind directionality factor, $K_e$ = ground elevation factor, $V$ = basic wind speed (mph)" },
        { name: "Design Wind Pressure", latex: "p = qGC_p - q_i(GC_{pi})", description: "Design wind pressure on MWFRS", reference: "ASCE 7-16 §27.4.1", variables: "$G$ = gust-effect factor, $C_p$ = external pressure coeff, $GC_{pi}$ = internal pressure coeff" },
      ],
    },
    {
      title: "Seismic Loads (ASCE 7-16 Chapter 12)",
      formulas: [
        { name: "Base Shear", latex: "V = C_s W", description: "Seismic base shear", reference: "ASCE 7-16 §12.8.1", variables: "$C_s$ = seismic response coefficient, $W$ = effective seismic weight" },
        { name: "Seismic Response Coefficient", latex: "C_s = \\frac{S_{DS}}{R/I_e}", description: "Design seismic coefficient", reference: "ASCE 7-16 §12.8.1.1", variables: "$S_{DS}$ = design spectral acceleration, $R$ = response modification factor, $I_e$ = importance factor" },
      ],
    },
  ],

  forces_and_load_effects: [
    {
      title: "Beam Diagrams",
      formulas: [
        { name: "Simple Beam - Uniform Load", latex: "M_{max} = \\frac{wL^2}{8}", description: "Maximum moment at midspan", reference: "AISC Table 3-23" },
        { name: "Simple Beam - Point Load", latex: "M_{max} = \\frac{PL}{4}", description: "Maximum moment at midspan", reference: "AISC Table 3-23" },
        { name: "Cantilever - Uniform Load", latex: "M_{max} = \\frac{wL^2}{2}", description: "Maximum moment at support", reference: "AISC Table 3-23" },
        { name: "Simple Beam - Deflection (uniform)", latex: "\\Delta_{max} = \\frac{5wL^4}{384EI}", description: "Maximum deflection at midspan", reference: "AISC Table 3-23" },
        { name: "Simple Beam - Deflection (point)", latex: "\\Delta_{max} = \\frac{PL^3}{48EI}", description: "Maximum deflection at midspan", reference: "AISC Table 3-23" },
      ],
    },
    {
      title: "Section Properties",
      formulas: [
        { name: "Moment of Inertia (rect)", latex: "I = \\frac{bh^3}{12}", description: "Rectangular section about centroid", reference: "General" },
        { name: "Section Modulus", latex: "S = \\frac{I}{c}", description: "Elastic section modulus", reference: "General" },
        { name: "Plastic Section Modulus", latex: "Z = \\frac{A}{2}(\\bar{y}_1 + \\bar{y}_2)", description: "Plastic section modulus", reference: "General" },
        { name: "Radius of Gyration", latex: "r = \\sqrt{\\frac{I}{A}}", description: "Used in column buckling", reference: "General" },
      ],
    },
  ],

  materials_and_properties: [
    {
      title: "Concrete Properties (ACI 318)",
      formulas: [
        { name: "Modulus of Elasticity", latex: "E_c = 57000\\sqrt{f'_c}", description: "Normal weight concrete (psi)", reference: "ACI 318 §19.2.2" },
        { name: "Modulus of Rupture", latex: "f_r = 7.5\\lambda\\sqrt{f'_c}", description: "Flexural tensile strength (psi)", reference: "ACI 318 §19.2.3" },
        { name: "Beta-1 Factor", latex: "\\beta_1 = 0.85 - 0.05\\frac{f'_c - 4000}{1000} \\geq 0.65", description: "Whitney stress block", reference: "ACI 318 §22.2.2.4.3" },
      ],
    },
    {
      title: "Steel Properties (AISC)",
      formulas: [
        { name: "Modulus of Elasticity", latex: "E_s = 29{,}000 \\text{ ksi}", description: "Steel elastic modulus", reference: "AISC §2" },
        { name: "Yield Strengths", latex: "F_y = 36, 50, 65 \\text{ ksi (common)}", description: "A36, A992, A572 Gr.50/65", reference: "AISC Table 2-4" },
      ],
    },
  ],

  component_design_and_detailing: [
    {
      title: "Concrete Flexure (ACI 318)",
      formulas: [
        { name: "Nominal Moment", latex: "M_n = A_s f_y \\left(d - \\frac{a}{2}\\right)", description: "Singly reinforced beam", reference: "ACI 318 §22.2", variables: "$A_s$ = steel area, $f_y$ = yield stress, $d$ = effective depth, $a$ = stress block depth" },
        { name: "Stress Block Depth", latex: "a = \\frac{A_s f_y}{0.85 f'_c b}", description: "Whitney stress block depth", reference: "ACI 318 §22.2.2.4" },
        { name: "Design Strength", latex: "\\phi M_n \\geq M_u", description: "φ = 0.9 (tension-controlled)", reference: "ACI 318 §21.2.1" },
        { name: "Min Reinforcement", latex: "A_{s,min} = \\max\\left(\\frac{3\\sqrt{f'_c}}{f_y}b_w d,\\ \\frac{200}{f_y}b_w d\\right)", description: "Minimum steel area", reference: "ACI 318 §9.6.1.2" },
      ],
    },
    {
      title: "Concrete Shear (ACI 318)",
      formulas: [
        { name: "Concrete Shear Strength", latex: "V_c = 2\\lambda\\sqrt{f'_c}\\, b_w d", description: "Simplified shear strength", reference: "ACI 318 §22.5.5.1" },
        { name: "Stirrup Contribution", latex: "V_s = \\frac{A_v f_{yt} d}{s}", description: "Vertical stirrup shear strength", reference: "ACI 318 §22.5.10.5.3" },
        { name: "Design Check", latex: "\\phi V_n = \\phi(V_c + V_s) \\geq V_u", description: "φ = 0.75 for shear", reference: "ACI 318 §21.2.1" },
      ],
    },
    {
      title: "Steel Tension (AISC)",
      formulas: [
        { name: "Gross Yielding", latex: "P_n = F_y A_g", description: "φ = 0.90 (LRFD), Ω = 1.67 (ASD)", reference: "AISC §D2(a)" },
        { name: "Net Rupture", latex: "P_n = F_u A_e", description: "φ = 0.75 (LRFD), Ω = 2.00 (ASD)", reference: "AISC §D2(b)", variables: "$A_e = UA_n$, where $U$ = shear lag factor" },
      ],
    },
    {
      title: "Steel Compression (AISC)",
      formulas: [
        { name: "Euler Buckling", latex: "F_e = \\frac{\\pi^2 E}{(KL/r)^2}", description: "Elastic critical buckling stress", reference: "AISC §E3" },
        { name: "Inelastic Buckling", latex: "F_{cr} = 0.658^{F_y/F_e} F_y", description: "When KL/r ≤ 4.71√(E/Fy)", reference: "AISC §E3(a)" },
        { name: "Elastic Buckling", latex: "F_{cr} = 0.877 F_e", description: "When KL/r > 4.71√(E/Fy)", reference: "AISC §E3(b)" },
        { name: "Design Strength", latex: "\\phi P_n = \\phi F_{cr} A_g", description: "φ = 0.90 (LRFD)", reference: "AISC §E1" },
      ],
    },
    {
      title: "Steel Flexure (AISC)",
      formulas: [
        { name: "Plastic Moment", latex: "M_p = F_y Z_x", description: "Full plastic moment", reference: "AISC §F2.1" },
        { name: "Compact Section", latex: "\\phi M_n = \\phi F_y Z_x", description: "φ = 0.90, L_b ≤ L_p", reference: "AISC §F2.1" },
        { name: "LTB Transition", latex: "M_n = C_b\\left[M_p - (M_p - 0.7F_yS_x)\\left(\\frac{L_b - L_p}{L_r - L_p}\\right)\\right]", description: "L_p < L_b ≤ L_r", reference: "AISC §F2.2" },
      ],
    },
    {
      title: "Connections",
      formulas: [
        { name: "Bolt Shear", latex: "R_n = F_{nv} A_b", description: "Nominal bolt shear strength per bolt", reference: "AISC §J3.6" },
        { name: "Bolt Bearing", latex: "R_n = 2.4 d t F_u", description: "Bearing strength (deformation acceptable)", reference: "AISC §J3.10" },
        { name: "Fillet Weld", latex: "R_n = 0.60 F_{EXX} \\times 0.707a \\times L", description: "Weld strength per length", reference: "AISC §J2.4", variables: "$a$ = weld leg size, $L$ = weld length, $F_{EXX}$ = electrode strength" },
      ],
    },
  ],

  temporary_structures_and_other: [
    {
      title: "Formwork & Shoring",
      formulas: [
        { name: "Lateral Concrete Pressure", latex: "p = wh", description: "Lateral pressure = unit weight × head", reference: "ACI 347" },
        { name: "Max Lateral Pressure", latex: "p_{max} = C_w C_c \\left[150 + \\frac{9000R}{T}\\right]", description: "Column forms, R ≤ 7 ft/hr", reference: "ACI 347R §6.2", variables: "$R$ = rate of placement (ft/hr), $T$ = concrete temp (°F)" },
      ],
    },
  ],
};
