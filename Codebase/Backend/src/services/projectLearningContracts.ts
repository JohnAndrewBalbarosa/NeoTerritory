export interface ProjectBriefInput {
  projectId: string;
  projectTitle: string;
  businessSpecs: string[];
  architectureSpecs: string[];
  businessProcess: string;
}

export interface ProjectLearningScope {
  projectId: string;
  scopeVersion: string;
  requiredPatterns: string[];
  requiredModules: string[];
  excludedPatterns: string[];
  requiredTopics?: string[]; // Added based on controller doc
  notes: string[];
  confidence?: 'low' | 'medium' | 'high';
  status: string;
}

export interface Toggle {
  key: string;
  enabled: boolean;
}

export interface ToggleManifest {
  projectId: string;
  scopeVersion: string;
  toggles: Toggle[];
  implicitDeny: boolean;
  status: string;
}

export interface AssessmentAnswer {
  questionId: string;
  answer: string;
}

export interface AssessmentAttempt {
  projectId: string;
  internId: string;
  moduleId: string;
  attemptType: 'pretest' | 'posttest';
  answers: AssessmentAnswer[];
}

export interface AssessmentRecord {
  projectId: string;
  internId: string;
  moduleId: string;
  attemptType: 'pretest' | 'posttest';
  decision: 'pass' | 'fail' | 'retry';
  score: number;
  nextAction: string;
  waivedSections?: string[];
}

export interface ReadinessEvidenceBundle {
  projectId: string;
  internId: string;
  summaryStatus: 'ready' | 'not-ready';
  evidenceRef?: string;
  codeRuns: any[];
  answers: any[];
  scores: any[];
  rawResults: any[];
}

export interface ReadinessResponse {
  projectId: string;
  readyInterns: Array<{
    internId: string;
    status: string;
    evidenceRef: string;
    summary?: {
      pretest: string;
      posttest: string;
    };
  }>;
}
