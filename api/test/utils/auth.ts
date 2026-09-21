import type { TestApp } from './app';

export interface Login {
  token: string;
  cookie: string;
  body: Record<string, unknown>;
}

function refreshCookie(setCookie: string[] | string | undefined, name: string): string {
  const list = Array.isArray(setCookie) ? setCookie : setCookie ? [setCookie] : [];
  const found = list.find((c) => c.startsWith(`${name}=`));
  return found ? found.split(';')[0] : '';
}

export async function login(t: TestApp, username: string, password: string): Promise<Login> {
  const res = await t.http().post('/api/auth/login').send({ username, password });
  if (res.status !== 200 || !res.body.accessToken) {
    throw new Error(
      `login ${username} failed: ${res.status} ${JSON.stringify(res.body)} text=${JSON.stringify(res.text)} headers=${JSON.stringify(res.headers)}`,
    );
  }
  return { token: res.body.accessToken, cookie: refreshCookie(res.headers['set-cookie'], 'wc_rt'), body: res.body };
}

export async function showroomLogin(t: TestApp, username: string, password: string): Promise<Login> {
  const res = await t.http().post('/api/auth/showroom/login').send({ username, password });
  if (res.status !== 200) throw new Error(`showroom login ${username} failed: ${res.status} ${JSON.stringify(res.body)}`);
  return { token: res.body.accessToken, cookie: refreshCookie(res.headers['set-cookie'], 'wc_srt'), body: res.body };
}

export const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });
export const csrf = { 'X-Requested-With': 'wolfcar' };
