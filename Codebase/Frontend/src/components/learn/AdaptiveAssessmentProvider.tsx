import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';
import { BloomTaxonomy } from '../../data/learningModules';

export type AssessmentStatus = 'idle' | 'in_progress' | 'failed_pretest' | 'completed';

export interface AdaptiveAssessmentState {
  currentLevel: number; // 1 to 6
  status: AssessmentStatus;
  activeModuleIds: Set<string>;
  eliminatedModuleIds: Set<string>;
}

interface AdaptiveAssessmentContextValue extends AdaptiveAssessmentState {
  nextLevel: () => void;
  eliminateModules: (moduleIds: string[]) => void;
  initializeActiveModules: (moduleIds: string[]) => void;
  reset: () => void;
  getTaxonomyForLevel: (level: number) => BloomTaxonomy;
  getLevelForTaxonomy: (taxonomy: BloomTaxonomy) => number;
}

const BLOOM_LEVELS: BloomTaxonomy[] = [
  'remembering',
  'understanding',
  'applying',
  'analyzing',
  'evaluating',
  'creating',
];

const AdaptiveAssessmentContext = createContext<AdaptiveAssessmentContextValue | undefined>(undefined);

export const AdaptiveAssessmentProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentLevel, setCurrentLevel] = useState(1);
  const [status, setStatus] = useState<AssessmentStatus>('in_progress');
  const [activeModuleIds, setActiveModuleIds] = useState<Set<string>>(new Set());
  const [eliminatedModuleIds, setEliminatedModuleIds] = useState<Set<string>>(new Set());

  const getTaxonomyForLevel = useCallback((level: number): BloomTaxonomy => {
    return BLOOM_LEVELS[level - 1];
  }, []);

  const getLevelForTaxonomy = useCallback((taxonomy: BloomTaxonomy): number => {
    return BLOOM_LEVELS.indexOf(taxonomy) + 1;
  }, []);

  const initializeActiveModules = useCallback((moduleIds: string[]) => {
    setActiveModuleIds(new Set(moduleIds));
    setEliminatedModuleIds(new Set());
  }, []);

  const eliminateModules = useCallback((moduleIds: string[]) => {
    setActiveModuleIds((prev) => {
      const next = new Set(prev);
      moduleIds.forEach((id) => next.delete(id));
      return next;
    });
    setEliminatedModuleIds((prev) => {
      const next = new Set(prev);
      moduleIds.forEach((id) => next.add(id));
      return next;
    });
  }, []);

  const nextLevel = useCallback(() => {
    if (currentLevel < 6 && activeModuleIds.size > 0) {
      setCurrentLevel((prev) => prev + 1);
    } else {
      setStatus('completed');
    }
  }, [currentLevel, activeModuleIds.size]);

  const reset = useCallback(() => {
    setCurrentLevel(1);
    setStatus('in_progress');
    setActiveModuleIds(new Set());
    setEliminatedModuleIds(new Set());
  }, []);

  const value = useMemo(
    () => ({
      currentLevel,
      status,
      activeModuleIds,
      eliminatedModuleIds,
      nextLevel,
      eliminateModules,
      initializeActiveModules,
      reset,
      getTaxonomyForLevel,
      getLevelForTaxonomy,
    }),
    [
      currentLevel,
      status,
      activeModuleIds,
      eliminatedModuleIds,
      nextLevel,
      eliminateModules,
      initializeActiveModules,
      reset,
      getTaxonomyForLevel,
      getLevelForTaxonomy,
    ]
  );

  return (
    <AdaptiveAssessmentContext.Provider value={value}>
      {children}
    </AdaptiveAssessmentContext.Provider>
  );
};

export const useAdaptiveAssessment = () => {
  const context = useContext(AdaptiveAssessmentContext);
  if (context === undefined) {
    throw new Error('useAdaptiveAssessment must be used within an AdaptiveAssessmentProvider');
  }
  return context;
};
