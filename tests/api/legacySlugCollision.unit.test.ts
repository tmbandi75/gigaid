import { MemStorage } from '../../server/storage';
import type { User } from '../../shared/schema';

function makeUser(id: string, overrides: Partial<User> = {}): User {
  return {
    id,
    username: `u-${id.slice(0, 4)}`,
    password: 'x',
    phone: null,
    email: null,
    displayName: null,
    publicProfileEnabled: true,
    publicProfileSlug: null,
    ...overrides,
  } as unknown as User;
}

describe('MemStorage.getUserByPublicSlug — legacy `user-<8hex>` collision handling', () => {
  it('returns undefined when two users share the same first 8 hex chars (so the visitor is not silently sent to the wrong worker)', async () => {
    const storage = new MemStorage();
    const internal = storage as unknown as { users: Map<string, User> };

    const idA = 'b727046e-2a49-4e6c-b6b9-e56db4124f3c';
    const idB = 'b727046e-9999-4444-aaaa-111111111111';
    internal.users.set(idA, makeUser(idA, { publicProfileSlug: 'otis-plumbing-llc' }));
    internal.users.set(idB, makeUser(idB, { publicProfileSlug: 'second-business' }));

    const result = await storage.getUserByPublicSlug('user-b727046e');
    expect(result).toBeUndefined();
  });

  it('still resolves the unique match when only one user has that prefix', async () => {
    const storage = new MemStorage();
    const internal = storage as unknown as { users: Map<string, User> };

    const idA = 'b727046e-2a49-4e6c-b6b9-e56db4124f3c';
    const idB = 'aaaaaaaa-9999-4444-aaaa-111111111111';
    internal.users.set(idA, makeUser(idA, { publicProfileSlug: 'otis-plumbing-llc' }));
    internal.users.set(idB, makeUser(idB, { publicProfileSlug: 'someone-else' }));

    const result = await storage.getUserByPublicSlug('user-b727046e');
    expect(result?.id).toBe(idA);
  });
});
