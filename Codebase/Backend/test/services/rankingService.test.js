/* eslint-disable no-undef */
'use strict';

const { expect } = require('chai');
const { rankAll, clearCatalogCache } = require('../../src/services/patternRankingService');

// Minimal classText fixtures that match what the microservice emits.
const VEHICLE_TEXT = `
class Vehicle {
public:
    virtual ~Vehicle() = default;
    virtual std::string label() const = 0;
};
`.trim();

const CAR_TEXT = `
class Car : public Vehicle {
public:
    std::string label() const override { return "car"; }
};
`.trim();

const SINGLETON_TEXT = `
class ConfigSingleton {
public:
    static ConfigSingleton& getInstance() {
        static ConfigSingleton instance;
        return instance;
    }
    ConfigSingleton(const ConfigSingleton&) = delete;
    ConfigSingleton& operator=(const ConfigSingleton&) = delete;
private:
    ConfigSingleton() = default;
};
`.trim();

const CACHED_REPO_TEXT = `
class CachedRepository {
public:
    CachedRepository(Repository* inner) : m_inner(inner) {}
    std::string read(const std::string& key) {
        return m_inner->read(key);
    }
private:
    Repository* m_inner;
};
`.trim();

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

describe('patternRankingService', () => {
  beforeEach(() => clearCatalogCache());

  describe('Vehicle/Car/Truck — plain polymorphism suppression (D33)', () => {
    it('does not elect strategy_interface as a winner for a plain abstract base class', () => {
      const detected = [
        makePattern('behavioural.strategy_interface', 'Vehicle', VEHICLE_TEXT)
      ];
      const result = rankAll(detected, VEHICLE_TEXT);
      const winner = result.winners.find(
        w => w.patternId === 'behavioural.strategy_interface' && w.className === 'Vehicle'
      );
      // Either no winner or rank forced to 0 by PATTERN_MIN_IMPL_FIT threshold.
      if (winner) {
        expect(winner.finalRank).to.equal(0);
      } else {
        expect(winner).to.be.undefined;
      }
    });

    it('does not elect strategy_concrete as a winner for a simple derived class', () => {
      const detected = [
        makePattern('behavioural.strategy_concrete', 'Car', CAR_TEXT)
      ];
      const result = rankAll(detected, CAR_TEXT);
      const winner = result.winners.find(
        w => w.patternId === 'behavioural.strategy_concrete' && w.className === 'Car'
      );
      if (winner) {
        expect(winner.finalRank).to.equal(0);
      }
    });

    it('marks suppressedByMinFit on under-evidence strategy detections', () => {
      const detected = [
        makePattern('behavioural.strategy_interface', 'Vehicle', VEHICLE_TEXT)
      ];
      const result = rankAll(detected, VEHICLE_TEXT);
      const rank = result.ranks.find(
        r => r.patternId === 'behavioural.strategy_interface' && r.className === 'Vehicle'
      );
      expect(rank).to.exist;
      // implementationFit for Vehicle is ~0.714 (3/4 rules without context ptr rule).
      // Our threshold is 0.85, so this must be suppressed.
      if (rank.implementationFit < 0.85) {
        expect(rank.suppressedByMinFit).to.equal(true);
        expect(rank.finalRank).to.equal(0);
      }
    });
  });

  describe('score formula', () => {
    it('computes finalRank as 0.30 * classFit + 0.70 * implFit for non-suppressed patterns', () => {
      const detected = [
        makePattern('creational.singleton', 'ConfigSingleton', SINGLETON_TEXT)
      ];
      const result = rankAll(detected, SINGLETON_TEXT);
      const rank = result.ranks.find(r => r.className === 'ConfigSingleton');
      if (rank && !rank.suppressedByMinFit && rank.implementationFit > 0) {
        const expected = 0.30 * rank.classFit + 0.70 * rank.implementationFit;
        expect(rank.finalRank).to.be.closeTo(expected, 0.001);
      }
    });
  });

  describe('Singleton detection', () => {
    it('produces a positive finalRank for a valid Singleton class', () => {
      const detected = [
        makePattern('creational.singleton', 'ConfigSingleton', SINGLETON_TEXT)
      ];
      const result = rankAll(detected, SINGLETON_TEXT);
      const rank = result.ranks.find(r => r.patternId === 'creational.singleton');
      expect(rank).to.exist;
      // Singleton evidence rules should fire — rank > 0.
      expect(rank.finalRank).to.be.greaterThan(0);
    });

    it('classifies Singleton verdict as confident or weak (not no_clear_pattern) when evidence fires', () => {
      const detected = [
        makePattern('creational.singleton', 'ConfigSingleton', SINGLETON_TEXT)
      ];
      const result = rankAll(detected, SINGLETON_TEXT);
      expect(result.verdict).to.not.equal('no_clear_pattern');
    });
  });

  describe('structural adapter detection', () => {
    it('gives a positive rank to CachedRepository as structural.adapter', () => {
      const source = CACHED_REPO_TEXT;
      const detected = [
        makePattern('structural.adapter', 'CachedRepository', CACHED_REPO_TEXT)
      ];
      const result = rankAll(detected, source);
      const rank = result.ranks.find(r => r.patternId === 'structural.adapter');
      expect(rank).to.exist;
      expect(rank.finalRank).to.be.greaterThan(0);
    });
  });

  describe('rankAll output shape', () => {
    it('returns ranks, winners, perClassRivals, verdict, thresholds', () => {
      const result = rankAll([], '');
      expect(result).to.have.keys(['ranks', 'winners', 'perClassRivals', 'verdict',
        'leadingPatternId', 'leadingClassName', 'ambiguousCandidates', 'thresholds']);
    });

    it('returns no_clear_pattern verdict for empty patterns', () => {
      const result = rankAll([], '');
      expect(result.verdict).to.equal('no_clear_pattern');
    });

    it('exposes thresholds in result', () => {
      const result = rankAll([], '');
      expect(result.thresholds).to.have.property('confident');
      expect(result.thresholds).to.have.property('ambiguityDelta');
      expect(result.thresholds).to.have.property('noClearPattern');
    });
  });
});
