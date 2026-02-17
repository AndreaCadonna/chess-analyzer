/**
 * Unit tests for accuracy calculation math.
 *
 * These test the pure math functions used in AnalysisService
 * without importing the class (which has heavy dependencies).
 */

// Reproduce the static helper functions exactly as in analysisService.ts
function cpToWinProbability(cp) {
  return 100 / (1 + Math.exp(-0.00368208 * cp));
}

function wclToAccuracy(wcl) {
  if (wcl < 0) return 100;
  const accuracy = 103.1668 * Math.exp(-0.04354 * wcl) - 3.1669;
  return Math.max(0, Math.min(100, accuracy));
}

function estimateWplFromCentipawnLoss(cpLoss, storedEval, moveNumber) {
  const isWhiteMove = moveNumber % 2 === 1;
  const bestEvalMoverPerspective = isWhiteMove ? storedEval : -storedEval;
  const playerEvalMoverPerspective = bestEvalMoverPerspective - cpLoss;
  const wpl = cpToWinProbability(bestEvalMoverPerspective) - cpToWinProbability(playerEvalMoverPerspective);
  return Math.max(0, wpl);
}

describe("cpToWinProbability", () => {
  test("cp=0 gives 50%", () => {
    expect(cpToWinProbability(0)).toBeCloseTo(50, 1);
  });

  test("cp=100 gives ~59%", () => {
    const result = cpToWinProbability(100);
    expect(result).toBeGreaterThan(55);
    expect(result).toBeLessThan(65);
  });

  test("cp=-100 gives ~41%", () => {
    const result = cpToWinProbability(-100);
    expect(result).toBeGreaterThan(35);
    expect(result).toBeLessThan(45);
  });

  test("cp=10000 is close to 100%", () => {
    expect(cpToWinProbability(10000)).toBeCloseTo(100, 0);
  });

  test("cp=-10000 is close to 0%", () => {
    expect(cpToWinProbability(-10000)).toBeCloseTo(0, 0);
  });

  test("symmetric around 0", () => {
    const pos = cpToWinProbability(200);
    const neg = cpToWinProbability(-200);
    expect(pos + neg).toBeCloseTo(100, 5);
  });
});

describe("wclToAccuracy", () => {
  test("wcl=0 gives ~100%", () => {
    expect(wclToAccuracy(0)).toBeCloseTo(100, 0);
  });

  test("wcl=5 gives ~80%", () => {
    const result = wclToAccuracy(5);
    expect(result).toBeGreaterThan(75);
    expect(result).toBeLessThan(85);
  });

  test("wcl=16 gives ~50%", () => {
    const result = wclToAccuracy(16);
    expect(result).toBeGreaterThan(45);
    expect(result).toBeLessThan(55);
  });

  test("wcl=80 gives ~0%", () => {
    const result = wclToAccuracy(80);
    expect(result).toBeCloseTo(0, 0);
  });

  test("negative wcl gives 100%", () => {
    expect(wclToAccuracy(-5)).toBe(100);
  });

  test("never exceeds 100 or goes below 0", () => {
    expect(wclToAccuracy(0)).toBeLessThanOrEqual(100);
    expect(wclToAccuracy(1000)).toBeGreaterThanOrEqual(0);
  });
});

describe("estimateWplFromCentipawnLoss", () => {
  test("zero cpLoss gives zero wpl", () => {
    expect(estimateWplFromCentipawnLoss(0, 50, 1)).toBeCloseTo(0, 5);
  });

  test("small cpLoss in equal position gives small wpl", () => {
    // 25cp loss from an equal position (eval=0, white move)
    const wpl = estimateWplFromCentipawnLoss(25, 0, 1);
    expect(wpl).toBeGreaterThan(0);
    expect(wpl).toBeLessThan(5);
  });

  test("large cpLoss gives larger wpl", () => {
    const small = estimateWplFromCentipawnLoss(25, 0, 1);
    const large = estimateWplFromCentipawnLoss(300, 0, 1);
    expect(large).toBeGreaterThan(small);
  });

  test("cpLoss in winning position gives less wpl than in equal position", () => {
    // When already winning (+500cp), losing 100cp matters less
    const wplWinning = estimateWplFromCentipawnLoss(100, 500, 1);
    const wplEqual = estimateWplFromCentipawnLoss(100, 0, 1);
    expect(wplWinning).toBeLessThan(wplEqual);
  });

  test("handles black moves correctly", () => {
    // Black move (even number), storedEval is white-perspective
    // If white is +100 (stored), black's mover-perspective is -100
    const wpl = estimateWplFromCentipawnLoss(50, 100, 2);
    expect(wpl).toBeGreaterThan(0);
  });

  test("never returns negative", () => {
    expect(estimateWplFromCentipawnLoss(0, 0, 1)).toBeGreaterThanOrEqual(0);
    expect(estimateWplFromCentipawnLoss(10, 500, 1)).toBeGreaterThanOrEqual(0);
  });
});

describe("accuracy calculation integration", () => {
  /**
   * Simulate calculateGameStatistics logic with WCL
   */
  function calculateAccuracy(moves) {
    const whiteMoves = moves.filter((m) => m.moveNumber % 2 === 1);
    const blackMoves = moves.filter((m) => m.moveNumber % 2 === 0);

    const avgWcl = (arr) =>
      arr.length > 0
        ? arr.reduce((sum, m) => sum + m.winProbabilityLoss, 0) / arr.length
        : 0;

    return {
      white: Math.round(wclToAccuracy(avgWcl(whiteMoves)) * 100) / 100,
      black: Math.round(wclToAccuracy(avgWcl(blackMoves)) * 100) / 100,
      overall: Math.round(wclToAccuracy(avgWcl(moves)) * 100) / 100,
    };
  }

  test("all perfect moves gives 100% accuracy", () => {
    const moves = Array.from({ length: 40 }, (_, i) => ({
      moveNumber: i + 1,
      winProbabilityLoss: 0,
    }));
    const acc = calculateAccuracy(moves);
    expect(acc.white).toBeCloseTo(100, 0);
    expect(acc.black).toBeCloseTo(100, 0);
    expect(acc.overall).toBeCloseTo(100, 0);
  });

  test("typical game with decent play gives 70-90% accuracy", () => {
    // Simulate a typical game: mostly good moves (wcl ~2-3), occasional inaccuracy (wcl ~8)
    const moves = [
      { moveNumber: 1, winProbabilityLoss: 1 },
      { moveNumber: 2, winProbabilityLoss: 2 },
      { moveNumber: 3, winProbabilityLoss: 0 },
      { moveNumber: 4, winProbabilityLoss: 3 },
      { moveNumber: 5, winProbabilityLoss: 8 },  // inaccuracy
      { moveNumber: 6, winProbabilityLoss: 1 },
      { moveNumber: 7, winProbabilityLoss: 2 },
      { moveNumber: 8, winProbabilityLoss: 2 },
      { moveNumber: 9, winProbabilityLoss: 0 },
      { moveNumber: 10, winProbabilityLoss: 4 },
    ];
    const acc = calculateAccuracy(moves);
    expect(acc.overall).toBeGreaterThan(70);
    expect(acc.overall).toBeLessThan(95);
  });

  test("game with blunders gives lower accuracy", () => {
    const moves = [
      { moveNumber: 1, winProbabilityLoss: 1 },
      { moveNumber: 2, winProbabilityLoss: 2 },
      { moveNumber: 3, winProbabilityLoss: 30 },  // blunder
      { moveNumber: 4, winProbabilityLoss: 3 },
      { moveNumber: 5, winProbabilityLoss: 25 },  // blunder
      { moveNumber: 6, winProbabilityLoss: 1 },
    ];
    const acc = calculateAccuracy(moves);
    expect(acc.overall).toBeLessThan(70);
  });

  test("comparison: old ACPL method vs new WCL method", () => {
    // With ACPL=25 (decent player), old formula gives ~31% — way too low
    const oldAccuracy = 103.1668 * Math.exp(-0.04354 * 25) - 3.1669;
    expect(oldAccuracy).toBeLessThan(35);

    // Same player with WCL approach: avg WCL ~5 gives ~80%
    const newAccuracy = wclToAccuracy(5);
    expect(newAccuracy).toBeGreaterThan(75);

    // The new method produces much more reasonable results
    expect(newAccuracy).toBeGreaterThan(oldAccuracy * 2);
  });
});
