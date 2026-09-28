import localities from './signup-localities.json';

// Reference geography only. Both repositories must ship this identical catalog.
// Production hierarchy verified read-only on 2026-09-28.
export const SIGNUP_CATALOG_VERSION = '2026-09-28.1';
export const SIGNUP_LOCALITIES = localities;
export type SignupLocality = (typeof localities)[number];

export function resolveSignupLocality(id: unknown, version: unknown): SignupLocality | null {
  if (typeof id !== 'string' || version !== SIGNUP_CATALOG_VERSION) return null;
  return localities.find(place => place.id === id) ?? null;
}

export function displaySignupCity(name: string): string {
  return name === 'בינימין' ? 'בנימין' : name;
}
