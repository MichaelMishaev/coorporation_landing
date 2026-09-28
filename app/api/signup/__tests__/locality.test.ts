import { afterEach, describe, expect, it, vi } from 'vitest';
import { SIGNUP_LOCALITIES, SIGNUP_CATALOG_VERSION } from '@/lib/signup-localities';
const submit = vi.hoisted(() => vi.fn(async () => ({ type: 'success' })));
vi.mock('@/lib/prisma', () => ({ prisma: {} }));
vi.mock('@/lib/signup/submit-signup', () => ({ submitSignup: submit }));
import { POST } from '../route';
const place = SIGNUP_LOCALITIES.find(x => x.name === 'בית אל')!;
const request = (overrides = {}) => new Request('http://localhost/api/signup', { method: 'POST', headers: { 'x-forwarded-for': '127.0.0.1' }, body: JSON.stringify({ fullName: 'בדיקת יישוב', phone: '0501234567', cityName: place.displayCity, locationId: place.id, catalogVersion: SIGNUP_CATALOG_VERSION, privacyAccepted: true, clientSubmissionId: 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa', ...overrides }) });
afterEach(() => { vi.unstubAllEnvs(); submit.mockClear(); });
describe('locality signup boundary', () => {
  it('rejects locality submissions while disabled', async () => {
    vi.stubEnv('SIGNUP_LOCALITIES_ENABLED', 'false');
    expect((await POST(request())).status).toBe(400);
    expect(submit).not.toHaveBeenCalled();
  });
  it.each([{ locationId: 'unknown' }, { catalogVersion: 'old' }, { cityName: 'נתניה' }])('rejects stale, unknown or mismatched input %j', async body => {
    vi.stubEnv('SIGNUP_LOCALITIES_ENABLED', 'true');
    expect((await POST(request(body))).status).toBe(400);
    expect(submit).not.toHaveBeenCalled();
  });
  it('derives the stored parent and neighborhood from the catalog', async () => {
    vi.stubEnv('SIGNUP_LOCALITIES_ENABLED', 'true');
    expect((await POST(request())).status).toBe(200);
    expect(submit).toHaveBeenCalledWith({}, expect.objectContaining({ cityName: 'בינימין', neighborhoodName: 'בית אל', locationId: place.id, catalogVersion: SIGNUP_CATALOG_VERSION }));
  });
});
