/**
 * Answer verification / evaluation feedback loop.
 * After the tutor generates a response containing calculations,
 * this module extracts the math claims and verifies them using
 * the calculator, then flags any inconsistencies.
 */

import { generateText } from "./client";
import { evaluateExpression, type CalculatorResult } from "./calculator";

export interface VerificationResult {
  verified: boolean;
  errors: VerificationError[];
  checksPerformed: number;
}

export interface VerificationError {
  claim: string;
  expected: string;
  actual: string;
  severity: "critical" | "minor";
}

/**
 * Extract calculation claims from a tutor response and verify them.
 * Uses the AI model to extract the math expressions, then evaluates each one.
 */
export async function verifyTutorResponse(
  tutorResponse: string
): Promise<VerificationResult> {
  // Skip verification for short responses or those without math
  if (tutorResponse.length < 100 || !containsCalculations(tutorResponse)) {
    return { verified: true, errors: [], checksPerformed: 0 };
  }

  const extractionResponse = await generateText({
    maxTokens: 1000,
    system: `Extract all numerical calculations from the tutor's response. For each calculation, provide:
1. The expression (using standard math notation the calculator can evaluate)
2. The claimed result from the text

Return a JSON array. Each item: {"expression": "...", "claimed_result": "...", "description": "..."}
If no verifiable calculations exist, return [].
Return ONLY the JSON array, no other text.

Rules for expressions:
- Use * for multiplication, / for division, ** for powers
- Use sqrt(), sin(), cos(), etc. for functions
- Use PI for π
- Expand any substituted values (e.g., if φMn = 0.9 × 60 × 3.0 × 18.5, write "0.9 * 60 * 3.0 * 18.5")
- Skip unit conversions and purely symbolic expressions`,
    messages: [
      {
        role: "user",
        content: `Extract verifiable calculations from this tutor response:\n\n${tutorResponse.slice(0, 3000)}`,
      },
    ],
  });

  const extractedText = extractionResponse.trim() || "[]";

  let claims: { expression: string; claimed_result: string; description: string }[];
  try {
    claims = JSON.parse(extractedText);
    if (!Array.isArray(claims)) claims = [];
  } catch {
    return { verified: true, errors: [], checksPerformed: 0 };
  }

  // Verify each claim
  const errors: VerificationError[] = [];

  for (const claim of claims.slice(0, 10)) {
    try {
      const result: CalculatorResult = evaluateExpression({
        expression: claim.expression,
        description: claim.description,
      });

      const claimedNum = parseClaimedResult(claim.claimed_result);
      if (claimedNum === null) continue;

      const relativeError =
        Math.abs(claimedNum) > 0.001
          ? Math.abs(result.result - claimedNum) / Math.abs(claimedNum)
          : Math.abs(result.result - claimedNum);

      if (relativeError > 0.01) {
        errors.push({
          claim: `${claim.expression} = ${claim.claimed_result}`,
          expected: result.formatted,
          actual: claim.claimed_result,
          severity: relativeError > 0.05 ? "critical" : "minor",
        });
      }
    } catch {
      continue;
    }
  }

  return {
    verified: errors.length === 0,
    errors,
    checksPerformed: claims.length,
  };
}

export function buildCorrectionPrompt(errors: VerificationError[]): string {
  const errorList = errors
    .map(
      (e) =>
        `- ${e.claim}: you wrote ${e.actual}, but the correct value is ${e.expected} (${e.severity})`
    )
    .join("\n");

  return `⚠️ INTERNAL MATH CHECK: The following calculation(s) in your response appear incorrect:

${errorList}

Please correct these calculations in your response. Show the corrected work clearly. Do NOT mention this verification system to the student — just naturally present the correct values.`;
}

function containsCalculations(text: string): boolean {
  return (
    /\d+\s*[×*]\s*\d+/.test(text) ||
    /=\s*[\d.]+\s*(kip|lb|kN|psi|ksi|ft|in|mm|m|k\b)/i.test(text) ||
    /\$\$[\s\S]*?=[\s\S]*?\d+[\s\S]*?\$\$/.test(text) ||
    /\$[^$]*=\s*[\d.]+[^$]*\$/.test(text)
  );
}

function parseClaimedResult(claimed: string): number | null {
  const cleaned = claimed
    .replace(/[,]/g, "")
    .replace(/\s*(kip|lb|kN|psi|ksi|ft|in|mm|m|k|plf|klf|psf|ksf|ft-kip|in-kip|kip-ft|kip-in|MPa|GPa)\b.*/i, "")
    .replace(/[≈≅~]/g, "")
    .trim();

  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}
