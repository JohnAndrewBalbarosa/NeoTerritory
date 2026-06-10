import { ReadinessEvidenceBundle, ReadinessResponse } from './projectLearningContracts';
import db from '../db/database';

export function buildReadinessEvidenceBundle(projectId: string, internId: string): ReadinessEvidenceBundle {
  // In a real system, we'd query the DB for all relevant evidence for this intern/project
  // For now, we'll return a mock bundle
  return {
    projectId,
    internId,
    summaryStatus: 'ready',
    evidenceRef: `ev-${Math.floor(Math.random() * 10000)}`,
    codeRuns: [
      { id: 'run-1', status: 'success', output: 'Adapter test passed' }
    ],
    answers: [
      { questionId: 'q1', text: 'An adapter converts one interface to another.' }
    ],
    scores: [
      { moduleId: 'adapter', type: 'pretest', score: 92 },
      { moduleId: 'adapter', type: 'posttest', score: 88 }
    ],
    rawResults: [
      { timestamp: new Date().toISOString(), event: 'Module completion' }
    ]
  };
}

export function listReadyInterns(projectId: string): ReadinessResponse {
  // Querying users who have completed modules
  // This is a simplified query for demonstration
  try {
    const rows = db.prepare(`
      SELECT DISTINCT u.id, u.username
      FROM users u
      JOIN learning_progress lp ON u.id = lp.user_id
      WHERE lp.completed_module_ids != '[]'
      LIMIT 10
    `).all() as any[];

    return {
      projectId,
      readyInterns: rows.map(r => ({
        internId: r.id.toString(),
        status: 'ready',
        evidenceRef: `ev-${r.id}`,
        summary: {
          pretest: 'pass',
          posttest: 'pass'
        }
      }))
    };
  } catch (err) {
    console.error('Error listing ready interns:', err);
    return { projectId, readyInterns: [] };
  }
}
