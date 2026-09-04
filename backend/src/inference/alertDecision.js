// Requires consecutive above-threshold classification passes before firing an
// alert, instead of a single spike, to reduce false positives from one noisy
// reading (e.g. a brief jolt while walking).
export function evaluateFallSignal(session, probability, { threshold = 0.6, requiredConsecutive = 2 } = {}) {
  session.consecutiveHits = probability >= threshold ? (session.consecutiveHits || 0) + 1 : 0;

  const shouldFire = session.consecutiveHits >= requiredConsecutive;
  if (shouldFire) session.consecutiveHits = 0;
  return shouldFire;
}
