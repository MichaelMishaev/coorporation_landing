import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { SignupForm } from '../SignupForm';
import { SIGNUP_LOCALITIES, SIGNUP_CATALOG_VERSION } from '@/lib/signup-localities';
import { CITIES } from '@/lib/cities';
import { installFetchMock, fillNameAndPhone, acceptPrivacy, selectCity, submittedBody } from './test-utils';

describe('shared personal-link locality choices', () => {
  it('preserves every city and adds the complete approved catalog', async () => {
    render(<SignupForm localitiesEnabled />);
    await userEvent.click(screen.getByRole('combobox'));
    expect(screen.getAllByRole('option')).toHaveLength(CITIES.length + 172);
    for (const name of [...CITIES, ...SIGNUP_LOCALITIES.map(place => place.name)]) expect(screen.getByRole('option', { name })).toBeInTheDocument();
  });
  it.each(['בית אל', 'אפרת', 'איתמר'])('submits %s as a stable locality with its parent', async name => {
    const user = userEvent.setup();
    const fetchMock = installFetchMock();
    render(<SignupForm localitiesEnabled />);
    await fillNameAndPhone(user);
    await selectCity(user, name);
    await acceptPrivacy(user);
    await user.click(screen.getByRole('button', { name: 'מצטרפ/ת כתומכ/ת' }));
    const place = SIGNUP_LOCALITIES.find(item => item.name === name)!;
    expect(submittedBody(fetchMock)).toMatchObject({ locationId: place.id, catalogVersion: SIGNUP_CATALOG_VERSION, cityName: place.displayCity });
  });
});
