/**
 * SM-2 Spaced Repetition Algorithm
 * Based on the SuperMemo SM-2 algorithm for optimal review scheduling.
 *
 * quality: 0-5 rating (0=complete blackout, 5=perfect recall)
 * For our use: correct on first try without hints = 5, with 1 hint = 4,
 * with 2 hints = 3, correct with 3 hints = 2, incorrect = 1, flagged skip = 0
 */

export interface SM2Input {
  quality: number; // 0-5
  repetitions: number;
  easeFactor: number;
  intervalDays: number;
}

export interface SM2Output {
  repetitions: number;
  easeFactor: number;
  intervalDays: number;
  nextReviewAt: Date;
}

export function sm2(input: SM2Input): SM2Output {
  const { quality, repetitions, easeFactor, intervalDays } = input;

  let newRepetitions: number;
  let newInterval: number;
  let newEaseFactor: number;

  if (quality >= 3) {
    // Correct response
    if (repetitions === 0) {
      newInterval = 1;
    } else if (repetitions === 1) {
      newInterval = 6;
    } else {
      newInterval = Math.round(intervalDays * easeFactor);
    }
    newRepetitions = repetitions + 1;
  } else {
    // Incorrect — reset
    newRepetitions = 0;
    newInterval = 1;
  }

  // Update ease factor
  newEaseFactor =
    easeFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));

  // Ease factor floor
  if (newEaseFactor < 1.3) newEaseFactor = 1.3;

  const nextReviewAt = new Date();
  nextReviewAt.setDate(nextReviewAt.getDate() + newInterval);

  return {
    repetitions: newRepetitions,
    easeFactor: Math.round(newEaseFactor * 100) / 100,
    intervalDays: newInterval,
    nextReviewAt,
  };
}

/**
 * Convert question attempt data to SM-2 quality score.
 */
export function attemptToQuality(
  isCorrect: boolean,
  hintsUsed: number,
  flagged: boolean
): number {
  if (flagged && !isCorrect) return 0;
  if (!isCorrect) return 1;
  if (hintsUsed >= 3) return 2;
  if (hintsUsed === 2) return 3;
  if (hintsUsed === 1) return 4;
  return 5; // Correct, no hints
}
