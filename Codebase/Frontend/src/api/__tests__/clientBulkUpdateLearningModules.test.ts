import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../store/appState', () => ({
  useAppStore: {
    getState: () => ({ token: 'test-token' }),
  },
}));

import { bulkUpdateLearningModules } from '../client';

describe('bulkUpdateLearningModules', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  it('posts visibility changes to the learner bulk endpoint', async () => {
    const fetchMock = globalThis.fetch as unknown as ReturnType<typeof vi.fn>;
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ ok: true, updatedCount: 2 }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }));

    await bulkUpdateLearningModules([
      { id: 'foundations-intro', published: true },
      { id: 'creational-singleton', published: false },
    ]);

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/learning/bulk',
      expect.objectContaining({
        method: 'PATCH',
      }),
    );
  });
});
