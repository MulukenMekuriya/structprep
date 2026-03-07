import type { NCEESTopic, Difficulty } from "@/types";

/**
 * Adaptive question selection algorithm.
 * Weights questions based on topic weakness, difficulty targeting,
 * recency, spaced repetition schedule, and time performance.
 *
 * P(question) = w_topic * w_difficulty * w_recency * w_sr * w_time
 */

interface QuestionCandidate {
  id: string;
  topic: NCEESTopic;
  difficulty: Difficulty;
  lastSeenAt: Date | null;
  srNextReviewAt: Date | null;
  avgTimeRatio: number | null; // actual time / estimated time
}

interface UserTopicStats {
  topic: NCEESTopic;
  accuracy: number; // 0-1
  totalAttempted: number;
}

interface SelectionWeights {
  topicWeight: number;
  difficultyWeight: number;
  recencyWeight: number;
  srWeight: number;
  timeWeight: number;
  totalWeight: number;
}

function getTopicWeight(accuracy: number): number {
  if (accuracy < 0.5) return 3.0;
  if (accuracy < 0.7) return 2.0;
  if (accuracy < 0.85) return 1.0;
  return 0.5;
}

function getDifficultyWeight(
  difficulty: Difficulty,
  recentAccuracy: number
): number {
  const difficultyMap: Record<Difficulty, number> = {
    easy: 1,
    medium: 2,
    hard: 3,
  };
  const level = difficultyMap[difficulty];

  // Target ~60-70% success rate
  if (recentAccuracy > 0.8) {
    // Doing well — bias harder
    return level === 3 ? 2.0 : level === 2 ? 1.5 : 0.5;
  }
  if (recentAccuracy < 0.5) {
    // Struggling — bias easier
    return level === 1 ? 2.0 : level === 2 ? 1.5 : 0.5;
  }
  // In the zone — all difficulties roughly equal
  return 1.0;
}

function getRecencyWeight(lastSeenAt: Date | null): number {
  if (!lastSeenAt) return 1.0; // Never seen

  const daysSince =
    (Date.now() - lastSeenAt.getTime()) / (1000 * 60 * 60 * 24);

  if (daysSince < 1) return 0.1; // Seen today
  if (daysSince < 7) return 0.5; // Seen this week
  return 1.0; // Not seen in 7+ days
}

function getSRWeight(nextReviewAt: Date | null): number {
  if (!nextReviewAt) return 1.0; // Not in SR queue

  const now = new Date();
  if (nextReviewAt <= now) {
    // Overdue
    const daysOverdue =
      (now.getTime() - nextReviewAt.getTime()) / (1000 * 60 * 60 * 24);
    return daysOverdue > 1 ? 3.0 : 5.0; // Due today gets highest priority
  }
  return 1.0; // Not due yet
}

function getTimeWeight(avgTimeRatio: number | null): number {
  if (!avgTimeRatio) return 1.0;
  return avgTimeRatio > 1.5 ? 1.5 : 1.0; // Boost questions user is slow on
}

export function scoreCandidate(
  question: QuestionCandidate,
  topicStats: Map<NCEESTopic, UserTopicStats>,
  overallRecentAccuracy: number
): SelectionWeights {
  const stats = topicStats.get(question.topic);
  const topicAccuracy = stats?.accuracy ?? 0.5; // Default 50% if no data

  const topicWeight = getTopicWeight(topicAccuracy);
  const difficultyWeight = getDifficultyWeight(
    question.difficulty,
    overallRecentAccuracy
  );
  const recencyWeight = getRecencyWeight(question.lastSeenAt);
  const srWeight = getSRWeight(question.srNextReviewAt);
  const timeWeight = getTimeWeight(question.avgTimeRatio);

  return {
    topicWeight,
    difficultyWeight,
    recencyWeight,
    srWeight,
    timeWeight,
    totalWeight:
      topicWeight * difficultyWeight * recencyWeight * srWeight * timeWeight,
  };
}

/**
 * Select the next question using weighted random selection.
 */
export function selectNextQuestion(
  candidates: QuestionCandidate[],
  topicStats: Map<NCEESTopic, UserTopicStats>,
  overallRecentAccuracy: number
): QuestionCandidate | null {
  if (candidates.length === 0) return null;

  const scored = candidates.map((q) => ({
    question: q,
    weights: scoreCandidate(q, topicStats, overallRecentAccuracy),
  }));

  const totalWeight = scored.reduce(
    (sum, s) => sum + s.weights.totalWeight,
    0
  );

  // Weighted random selection
  let random = Math.random() * totalWeight;
  for (const { question, weights } of scored) {
    random -= weights.totalWeight;
    if (random <= 0) return question;
  }

  // Fallback
  return scored[0].question;
}
