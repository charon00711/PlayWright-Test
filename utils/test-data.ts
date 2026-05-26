import type { APIRequestContext } from '@playwright/test';

export async function deleteUserByUsername(
  request: APIRequestContext,
  username: string,
) {
  const res = await request.get('/api/users');
  if (!res.ok()) return;
  const data = await res.json();
  const users = Array.isArray(data) ? data : (data.list ?? []);
  const target = users.find(
    (u: { username?: string; id?: number }) => u.username === username,
  );
  if (target?.id) {
    await request.delete(`/api/users/${target.id}`);
  }
}
