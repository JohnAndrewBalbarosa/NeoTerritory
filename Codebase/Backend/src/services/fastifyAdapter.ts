import axios from 'axios';

/**
 * Decoupled Fastify Adapter
 * 
 * Handles communication with the JavaScript-based Fastify service.
 * This keeps the main system clean and modular.
 */

const FASTIFY_URL = process.env.BACKEND_FASTIFY_URL || 'http://localhost:8000';

export interface FastifyAnalysisResult {
  status: string;
  patterns: Array<{ pattern_id: string; confidence: number }>;
}

export async function callJsAnalysis(code: string, filename: string): Promise<FastifyAnalysisResult | null> {
  try {
    const response = await axios.post(`${FASTIFY_URL}/analyze`, {
      code,
      filename
    }, {
      timeout: 5000
    });
    return response.data;
  } catch (error) {
    console.error('[Fastify Adapter] Failed to reach service:', (error as Error).message);
    return null;
  }
}

export async function checkFastifyHealth(): Promise<boolean> {
  try {
    const response = await axios.get(FASTIFY_URL);
    return response.status === 200;
  } catch {
    return false;
  }
}
