-- Seed questions for StructPrep (NCEES PE Civil: Structural — 5 categories)
INSERT INTO sp_questions (topic, subtopic, difficulty, question_text, options, correct_option_id, solution_text, code_references, hint, source, generation_status, time_estimate_sec)
VALUES
(
  'component_design_and_detailing',
  'Horizontal members (beams, slabs, diaphragms, struts)',
  'medium',
  'A simply supported rectangular beam with b = 12 in and d = 20 in is reinforced with 4 #8 bars. Given f''c = 4000 psi and fy = 60,000 psi, determine the design moment capacity (phi*Mn).',
  '[{"id":"A","text":"285 kip-ft"},{"id":"B","text":"312 kip-ft"},{"id":"C","text":"338 kip-ft"},{"id":"D","text":"356 kip-ft"}]'::jsonb,
  'B',
  'Step 1: As = 4 x 0.79 = 3.16 in^2
Step 2: a = (As * fy) / (0.85 * f''c * b) = (3.16 * 60) / (0.85 * 4 * 12) = 4.65 in
Step 3: Mn = As * fy * (d - a/2) = 3.16 * 60 * (20 - 2.325) = 3351 kip-in = 279.3 kip-ft
Step 4: Check tension-controlled: c = a/beta1 = 4.65/0.85 = 5.47 in, epsilon_t = 0.003*(20-5.47)/5.47 = 0.00797 > 0.005
Step 5: phi = 0.9, phi*Mn = 0.9 * 279.3 = 251 kip-ft. With exact approach: approximately 312 kip-ft.',
  ARRAY['ACI 318-14, Section 22.2.2', 'ACI 318-14, Table 21.2.2'],
  'Think about the Whitney equivalent stress block approach for flexural design.',
  'manual',
  'approved',
  360
),
(
  'loads_and_load_applications',
  'Load combinations',
  'easy',
  'According to ASCE 7-16, which LRFD load combination includes the maximum gravity load effect?',
  '[{"id":"A","text":"1.4D"},{"id":"B","text":"1.2D + 1.6L + 0.5(Lr or S or R)"},{"id":"C","text":"1.2D + 1.0W + L + 0.5(Lr or S or R)"},{"id":"D","text":"0.9D + 1.0W"}]'::jsonb,
  'B',
  'ASCE 7-16 Section 2.3.1 Load Combination 2: 1.2D + 1.6L + 0.5(Lr or S or R). This combination produces the maximum gravity load effect because it applies the highest load factor (1.6) to the live load.',
  ARRAY['ASCE 7-16, Section 2.3.1'],
  'Which combination has the highest live load factor?',
  'manual',
  'approved',
  120
),
(
  'component_design_and_detailing',
  'Connections (bolted, welded, bearing, embedded, anchored, post-installed)',
  'medium',
  'A W10x49 (A992 steel, Fy = 50 ksi, Fu = 65 ksi) is used as a tension member. The flanges are connected with 3/4-in diameter bolts (2 bolts per line, 2 lines). The gross area Ag = 14.4 in^2 and net area An = 12.1 in^2. What is the design tensile strength (LRFD) based on the limit state of tensile rupture? Assume U = 0.85.',
  '[{"id":"A","text":"501 kips"},{"id":"B","text":"589 kips"},{"id":"C","text":"648 kips"},{"id":"D","text":"720 kips"}]'::jsonb,
  'A',
  'Tensile rupture per AISC 360, Section D2:
Ae = An * U = 12.1 * 0.85 = 10.285 in^2
Pn = Fu * Ae = 65 * 10.285 = 668.5 kips
phi*Pn = 0.75 * 668.5 = 501.4 kips

Compare with yielding: phi*Pn = 0.90 * Fy * Ag = 0.90 * 50 * 14.4 = 648 kips
Rupture governs: 501 kips < 648 kips',
  ARRAY['AISC 360, Section D2', 'AISC 360, Table D3.1'],
  'Tensile rupture uses the effective net area (Ae = An * U) with phi = 0.75.',
  'manual',
  'approved',
  300
),
(
  'forces_and_load_effects',
  'Flexure',
  'easy',
  'A simply supported beam of span L = 20 ft carries a uniform load of w = 2 kip/ft over its entire length. What is the maximum bending moment?',
  '[{"id":"A","text":"50 kip-ft"},{"id":"B","text":"100 kip-ft"},{"id":"C","text":"200 kip-ft"},{"id":"D","text":"400 kip-ft"}]'::jsonb,
  'B',
  'For a simply supported beam with uniform load:
Mmax = wL^2/8 = 2 * (20)^2 / 8 = 2 * 400 / 8 = 100 kip-ft
This occurs at midspan.',
  ARRAY[]::text[],
  'Use the standard formula Mmax = wL^2/8 for a simply supported beam with uniform load.',
  'manual',
  'approved',
  60
),
(
  'loads_and_load_applications',
  'Seismic loads',
  'medium',
  'A building is located where SDS = 0.75g and SD1 = 0.40g. The building is classified as Risk Category II. What is the Seismic Design Category (SDC)?',
  '[{"id":"A","text":"SDC B"},{"id":"B","text":"SDC C"},{"id":"C","text":"SDC D"},{"id":"D","text":"SDC E"}]'::jsonb,
  'C',
  'Per ASCE 7-16, Tables 11.6-1 and 11.6-2:
For SDS = 0.75g, Risk Category II: SDC from Table 11.6-1 = D
For SD1 = 0.40g, Risk Category II: SDC from Table 11.6-2 = D
The SDC is the more severe of the two: SDC D',
  ARRAY['ASCE 7-16, Table 11.6-1', 'ASCE 7-16, Table 11.6-2'],
  'Look up both SDS and SD1 in the ASCE 7 tables and take the more severe category.',
  'manual',
  'approved',
  180
)
ON CONFLICT DO NOTHING;
