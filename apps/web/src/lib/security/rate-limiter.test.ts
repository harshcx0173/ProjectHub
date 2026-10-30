import { describe, it, expect } from 'vitest';
import { checkRateLimit } from './rate-limiter';

describe('Sliding Window Rate Limiter', () => {
  it('allows requests within limit', async () => {
    const id = `test-user-${Date.now()}`;
    const result1 = await checkRateLimit(id, { limit: 3, windowSeconds: 10 });
    expect(result1.success).toBe(true);
    expect(result1.remaining).toBe(2);

    const result2 = await checkRateLimit(id, { limit: 3, windowSeconds: 10 });
    expect(result2.success).toBe(true);
    expect(result2.remaining).toBe(1);

    const result3 = await checkRateLimit(id, { limit: 3, windowSeconds: 10 });
    expect(result3.success).toBe(true);
    expect(result3.remaining).toBe(0);
  });

  it('blocks requests exceeding limit', async () => {
    const id = `test-blocked-${Date.now()}`;
    await checkRateLimit(id, { limit: 2, windowSeconds: 10 });
    await checkRateLimit(id, { limit: 2, windowSeconds: 10 });

    const blocked = await checkRateLimit(id, { limit: 2, windowSeconds: 10 });
    expect(blocked.success).toBe(false);
    expect(blocked.remaining).toBe(0);
  });
});

