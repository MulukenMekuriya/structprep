/**
 * Structural engineering calculator tool for the AI tutor.
 * Provides Claude with a tool to evaluate mathematical expressions,
 * so it can verify its own calculations instead of doing mental math.
 */

export interface CalculatorToolDef {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
}

export const CALCULATOR_TOOL: CalculatorToolDef = {
  name: "calculator",
  description: `Evaluate a mathematical expression and return the numeric result. Use this to verify every calculation you present to the student — never rely on mental math.

Supports: +, -, *, /, ** (power), sqrt(), abs(), sin(), cos(), tan(), asin(), acos(), atan(), log() (natural), log10(), ceil(), floor(), round(), PI, E, min(), max().

Examples:
- "0.9 * 60 * 3.0 * (20 - 3.0/2)" → 2997
- "sqrt(200 * 12 / (3.14159 * 29000))" → 0.1619
- "1.2 * 25 + 1.6 * 40 + 0.5 * 30" → 109`,
  input_schema: {
    type: "object" as const,
    properties: {
      expression: {
        type: "string",
        description:
          "The mathematical expression to evaluate. Use standard math notation.",
      },
      description: {
        type: "string",
        description:
          "Brief description of what this calculation represents (e.g., 'factored moment Mu').",
      },
    },
    required: ["expression"],
  },
};

export interface CalculatorInput {
  expression: string;
  description?: string;
}

export interface CalculatorResult {
  result: number;
  expression: string;
  description?: string;
  formatted: string;
}

/**
 * Safely evaluate a mathematical expression.
 * Uses a restricted evaluator — no access to globals, require, etc.
 */
export function evaluateExpression(input: CalculatorInput): CalculatorResult {
  const { expression, description } = input;

  // Sanitize: only allow math characters, function names, and whitespace
  const sanitized = expression.replace(/\s+/g, " ").trim();

  const allowedPattern =
    /^[0-9+\-*/().,%\s^eE]+$|^[\w+\-*/().,%\s^eE]+$/;

  // More thorough validation: reject anything that looks like code injection
  const dangerous = /[;{}[\]`'"\\$@#!?&|~<>]|(?:function|return|var|let|const|import|require|eval|new|this|window|global|process)/i;
  if (dangerous.test(sanitized)) {
    throw new Error(`Expression contains disallowed characters: ${sanitized}`);
  }

  // Replace common math notation with JS equivalents
  let jsExpr = sanitized
    .replace(/\bPI\b/g, String(Math.PI))
    .replace(/\bE\b/g, String(Math.E))
    .replace(/\bsqrt\s*\(/g, "Math.sqrt(")
    .replace(/\babs\s*\(/g, "Math.abs(")
    .replace(/\bsin\s*\(/g, "Math.sin(")
    .replace(/\bcos\s*\(/g, "Math.cos(")
    .replace(/\btan\s*\(/g, "Math.tan(")
    .replace(/\basin\s*\(/g, "Math.asin(")
    .replace(/\bacos\s*\(/g, "Math.acos(")
    .replace(/\batan\s*\(/g, "Math.atan(")
    .replace(/\blog\s*\(/g, "Math.log(")
    .replace(/\blog10\s*\(/g, "Math.log10(")
    .replace(/\bceil\s*\(/g, "Math.ceil(")
    .replace(/\bfloor\s*\(/g, "Math.floor(")
    .replace(/\bround\s*\(/g, "Math.round(")
    .replace(/\bmin\s*\(/g, "Math.min(")
    .replace(/\bmax\s*\(/g, "Math.max(")
    .replace(/\bpow\s*\(/g, "Math.pow(")
    .replace(/\^/g, "**");

  // Final safety check: after substitution, only allow Math.*, numbers, and operators
  const postSubDangerous = /[a-zA-Z_](?!ath\b)/;
  const withoutMath = jsExpr.replace(/Math\.\w+/g, "0");
  if (postSubDangerous.test(withoutMath.replace(/[0-9eE.]/g, ""))) {
    throw new Error(`Expression contains unrecognized identifiers: ${sanitized}`);
  }

  // Evaluate using Function constructor with no scope access
  // eslint-disable-next-line @typescript-eslint/no-implied-eval
  const fn = new Function(`"use strict"; return (${jsExpr});`);
  const result = fn() as number;

  if (typeof result !== "number" || !isFinite(result)) {
    throw new Error(
      `Expression did not produce a finite number: ${sanitized} → ${result}`
    );
  }

  // Format to reasonable precision
  const formatted =
    Math.abs(result) >= 1000
      ? result.toFixed(1)
      : Math.abs(result) >= 1
        ? result.toFixed(4)
        : result.toFixed(6);

  return {
    result,
    expression: sanitized,
    description,
    formatted,
  };
}

/**
 * Process a calculator tool call from Claude's response.
 */
export interface ToolResultBlock {
  type: "tool_result";
  tool_use_id: string;
  content: string;
  is_error?: boolean;
}

export function processCalculatorToolCall(
  input: Record<string, unknown>
): ToolResultBlock {
  try {
    const calcInput: CalculatorInput = {
      expression: input.expression as string,
      description: input.description as string | undefined,
    };
    const result = evaluateExpression(calcInput);
    return {
      type: "tool_result",
      tool_use_id: "", // filled in by caller
      content: `${result.result}${result.description ? ` (${result.description})` : ""}`,
    };
  } catch (error) {
    return {
      type: "tool_result",
      tool_use_id: "", // filled in by caller
      content: `Error: ${error instanceof Error ? error.message : "calculation failed"}`,
      is_error: true,
    };
  }
}
