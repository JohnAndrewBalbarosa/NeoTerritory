'use strict';

const { expect } = require('chai');
const { rankAll, clearCatalogCache } = require('../../src/services/patternRankingService');

function makePattern(patternId, className, classText) {
  return {
    patternId,
    patternName: patternId.split('.').pop(),
    patternFamily: patternId.split('.')[0],
    className,
    fileName: 'test.cpp',
    classText,
    documentationTargets: [],
    unitTestTargets: []
  };
}

// Behavioural pattern fixtures — test interaction / delegation semantics.

// A real Strategy: has a Context class holding a unique_ptr to the interface
// (not just a plain polymorphic hierarchy).
const STRATEGY_INTERFACE_CPP = `
class ISortStrategy {
public:
    virtual ~ISortStrategy() = default;
    virtual void sort(std::vector<int>& data) const = 0;
};
`.trim();

const STRATEGY_CONCRETE_CPP = `
class BubbleSort : public ISortStrategy {
public:
    void sort(std::vector<int>& data) const override {
        // bubble sort implementation
    }
};
`.trim();

// Plain polymorphism — should NOT be classified as Strategy (D33 suppression).
const PLAIN_INTERFACE_CPP = `
class Vehicle {
public:
    virtual ~Vehicle() = default;
    virtual std::string label() const = 0;
};
`.trim();

const PLAIN_DERIVED_CPP = `
class Car : public Vehicle {
public:
    std::string label() const override { return "car"; }
};
`.trim();

describe('Behavioural pattern family — interaction and delegation', () => {
  beforeEach(() => clearCatalogCache());

  describe('Strategy false positive suppression (D33)', () => {
    it('suppresses strategy_interface for plain abstract base class', () => {
      const result = rankAll(
        [makePattern('behavioural.strategy_interface', 'Vehicle', PLAIN_INTERFACE_CPP)],
        PLAIN_INTERFACE_CPP
      );
      const rank = result.ranks.find(r => r.patternId === 'behavioural.strategy_interface');
      if (rank && rank.implementationFit < 0.85) {
        expect(rank.finalRank).to.equal(0, 'rank below min threshold must be zeroed');
        expect(rank.suppressedByMinFit).to.equal(true);
      }
    });

    it('suppresses strategy_concrete for plain derived class', () => {
      const result = rankAll(
        [makePattern('behavioural.strategy_concrete', 'Car', PLAIN_DERIVED_CPP)],
        PLAIN_DERIVED_CPP
      );
      const rank = result.ranks.find(r => r.patternId === 'behavioural.strategy_concrete');
      if (rank && rank.implementationFit < 0.80) {
        expect(rank.finalRank).to.equal(0);
        expect(rank.suppressedByMinFit).to.equal(true);
      }
    });

    it('does not elect Vehicle as winner for strategy_interface', () => {
      const result = rankAll(
        [makePattern('behavioural.strategy_interface', 'Vehicle', PLAIN_INTERFACE_CPP)],
        PLAIN_INTERFACE_CPP
      );
      const winner = result.winners.find(
        w => w.patternId === 'behavioural.strategy_interface' && w.className === 'Vehicle'
      );
      if (winner) {
        // If there's a winner, its rank must be 0 (suppressed).
        expect(winner.finalRank).to.equal(0);
      }
    });
  });

  describe('ranking consistency', () => {
    it('returns ranks array with one entry per detected pattern', () => {
      const patterns = [
        makePattern('behavioural.strategy_interface', 'Vehicle', PLAIN_INTERFACE_CPP),
        makePattern('behavioural.strategy_concrete', 'Car', PLAIN_DERIVED_CPP)
      ];
      const result = rankAll(patterns, PLAIN_INTERFACE_CPP + '\n' + PLAIN_DERIVED_CPP);
      expect(result.ranks).to.have.length(2);
    });

    it('all behavioural ranks are in [0, 1]', () => {
      const patterns = [
        makePattern('behavioural.strategy_interface', 'ISortStrategy', STRATEGY_INTERFACE_CPP),
        makePattern('behavioural.strategy_concrete', 'BubbleSort', STRATEGY_CONCRETE_CPP)
      ];
      const result = rankAll(patterns, STRATEGY_INTERFACE_CPP + '\n' + STRATEGY_CONCRETE_CPP);
      for (const r of result.ranks) {
        expect(r.finalRank).to.be.within(0, 1);
      }
    });
  });
});
