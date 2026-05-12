/**
 * Utility to calculate a consistent weighted technical score across the platform.
 * 
 * Weights:
 * - Resume Score: 20% (Initial screening)
 * - Verbal Round: 30% (Qualitative response quality)
 * - Coding Score: 50% (Technical performance)
 * 
 * @param {number} resumeScore - Score from 0-100
 * @param {number} codingScore - Score from 0-100
 * @param {number} verbalScore - Score from 0-100 (Overall evaluation score)
 * @returns {string} - Formatted score with 1 decimal place
 */
export const calculateFinalScore = (resumeScore = 0, codingScore = 0, verbalScore = 0) => {
  // If no coding or verbal round has been done yet, return only the resume score
  if (!codingScore && !verbalScore) return resumeScore.toFixed(1);

  // If we have verbal/coding, we use a global weighted average
  // Verbal score from AI is 0-10, so we normalize it to 0-100
  const normalizedVerbal = verbalScore * 10;

  const weightedScore = (resumeScore * 0.2) + (normalizedVerbal * 0.3) + (codingScore * 0.5);
  return weightedScore.toFixed(1);
};
