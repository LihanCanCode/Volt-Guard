import { test } from "node:test";
import assert from "node:assert/strict";
import { evaluateFallSignal } from "./alertDecision.js";

test("does not fire on a single above-threshold reading", () => {
  const session = {};
  const fired = evaluateFallSignal(session, 0.9, { threshold: 0.6 });
  assert.equal(fired, false);
  assert.equal(session.consecutiveHits, 1);
});

test("fires after two consecutive above-threshold readings", () => {
  const session = {};
  evaluateFallSignal(session, 0.9, { threshold: 0.6 });
  const fired = evaluateFallSignal(session, 0.85, { threshold: 0.6 });
  assert.equal(fired, true);
  assert.equal(session.consecutiveHits, 0);
});

test("resets the streak when a reading drops below threshold in between", () => {
  const session = {};
  evaluateFallSignal(session, 0.9, { threshold: 0.6 });
  const droppedFired = evaluateFallSignal(session, 0.2, { threshold: 0.6 });
  assert.equal(droppedFired, false);
  assert.equal(session.consecutiveHits, 0);

  const secondFired = evaluateFallSignal(session, 0.9, { threshold: 0.6 });
  assert.equal(secondFired, false);
  assert.equal(session.consecutiveHits, 1);
});

test("fires again after a reset once two more consecutive hits occur", () => {
  const session = {};
  evaluateFallSignal(session, 0.9, { threshold: 0.6 });
  evaluateFallSignal(session, 0.9, { threshold: 0.6 }); // fires, resets to 0

  evaluateFallSignal(session, 0.2, { threshold: 0.6 }); // stays reset
  evaluateFallSignal(session, 0.9, { threshold: 0.6 }); // hit 1
  const firedAgain = evaluateFallSignal(session, 0.9, { threshold: 0.6 }); // hit 2

  assert.equal(firedAgain, true);
  assert.equal(session.consecutiveHits, 0);
});
