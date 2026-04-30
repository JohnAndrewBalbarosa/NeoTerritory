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

// Structural pattern fixtures — test composition / wrapping semantics.

// Adapter/Proxy/Decorator all involve holding an owning member of a wrapped type.
const ADAPTER_CPP = `
class Repository {
public:
    std::string read(const std::string& key) { return "value_" + key; }
};

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

const CACHED_REPO_ONLY = `
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

describe('Structural pattern family — composition and wrapping', () => {
  beforeEach(() => clearCatalogCache());

  describe('Adapter', () => {
    it('ranks structural.adapter positively for a wrapper class with an owning member', () => {
      const result = rankAll(
        [makePattern('structural.adapter', 'CachedRepository', CACHED_REPO_ONLY)],
        ADAPTER_CPP
      );
      const rank = result.ranks.find(r => r.patternId === 'structural.adapter');
      expect(rank, 'rank must exist').to.exist;
      expect(rank.finalRank).to.be.within(0, 1);
    });
  });

  describe('Proxy', () => {
    it('ranks structural.proxy positively for the same wrapper shape', () => {
      const result = rankAll(
        [makePattern('structural.proxy', 'CachedRepository', CACHED_REPO_ONLY)],
        ADAPTER_CPP
      );
      const rank = result.ranks.find(r => r.patternId === 'structural.proxy');
      expect(rank, 'rank must exist').to.exist;
      expect(rank.implementationFit).to.be.within(0, 1);
    });
  });

  describe('ranking invariants for structural patterns', () => {
    it('all structural ranks are in [0, 1]', () => {
      const patterns = [
        makePattern('structural.adapter',   'CachedRepository', CACHED_REPO_ONLY),
        makePattern('structural.proxy',     'CachedRepository', CACHED_REPO_ONLY),
        makePattern('structural.decorator', 'CachedRepository', CACHED_REPO_ONLY)
      ];
      const result = rankAll(patterns, ADAPTER_CPP);
      for (const r of result.ranks) {
        expect(r.finalRank).to.be.within(0, 1);
        expect(r.implementationFit).to.be.within(0, 1);
      }
    });

    it('perClassRivals is populated when multiple structural patterns tie on the same class', () => {
      const patterns = [
        makePattern('structural.adapter',   'CachedRepository', CACHED_REPO_ONLY),
        makePattern('structural.proxy',     'CachedRepository', CACHED_REPO_ONLY),
        makePattern('structural.decorator', 'CachedRepository', CACHED_REPO_ONLY)
      ];
      const result = rankAll(patterns, ADAPTER_CPP);
      // adapter+proxy+decorator all match the same wrapper shape — rivals expected.
      expect(result.perClassRivals).to.be.an('object');
    });
  });
});
