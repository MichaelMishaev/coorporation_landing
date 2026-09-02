import { describe, it, expect, afterEach } from 'vitest';
import { prisma } from '@/lib/prisma';

describe('ReferralLinkMirror schema', () => {
  afterEach(async () => {
    await prisma.referralLinkMirror.deleteMany({ where: { code: { startsWith: 'test-' } } });
  });

  it('stores and retrieves a mirrored code with a city snapshot', async () => {
    await prisma.referralLinkMirror.create({
      data: { code: 'test-abc123', active: true, cityName: 'תל אביב' },
    });
    const found = await prisma.referralLinkMirror.findUnique({ where: { code: 'test-abc123' } });
    expect(found?.cityName).toBe('תל אביב');
    expect(found?.active).toBe(true);
  });

  it('allows a null cityName for Area Manager/SuperAdmin links', async () => {
    await prisma.referralLinkMirror.create({
      data: { code: 'test-xyz789', active: true, cityName: null },
    });
    const found = await prisma.referralLinkMirror.findUnique({ where: { code: 'test-xyz789' } });
    expect(found?.cityName).toBeNull();
  });
});
