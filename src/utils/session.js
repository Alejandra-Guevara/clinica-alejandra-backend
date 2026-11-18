import crypto from 'node:crypto';
import { runtimeConfig } from '../config/runtime.js';

const cookieName = 'ca_session';
const csrfName = 'ca_csrf';
const secret = () => runtimeConfig.sessionSecret;
const sign = (value) => crypto.createHmac('sha256', secret()).update(value).digest('base64url');

export function issueSession(userId,sessionVersion=0) {
  const payload = Buffer.from(JSON.stringify({ sub: String(userId), sv:Number(sessionVersion), exp: Math.floor(Date.now() / 1000) + 60 * 60 * 8 })).toString('base64url');
  return `${payload}.${sign(payload)}`;
}

export function readSession(value) {
  if (!value || !secret()) return null;
  const [payload, signature] = value.split('.');
  const expected = sign(payload || '');
  const left = Buffer.from(signature || '');
  const right = Buffer.from(expected);
  if (left.length !== right.length || !crypto.timingSafeEqual(left, right)) return null;
  try {
    const session = JSON.parse(Buffer.from(payload, 'base64url').toString());
    return session.exp > Date.now() / 1000 ? session : null;
  } catch { return null; }
}

export const setSessionCookie = (res, value) => res.cookie(cookieName, value, {
  httpOnly: true, secure: runtimeConfig.secureCookies,
  sameSite: 'lax', path: '/', maxAge: 8 * 60 * 60 * 1000,
});
export const clearSessionCookie = (res) => res.clearCookie(cookieName, { httpOnly: true, sameSite: 'lax', secure: runtimeConfig.secureCookies, path: '/' });
export const setCsrfCookie = (res, value) => res.cookie(csrfName, value, {
  httpOnly: false, secure: runtimeConfig.secureCookies,
  sameSite: 'lax', path: '/', maxAge: 8 * 60 * 60 * 1000,
});
export const clearCsrfCookie = (res) => res.clearCookie(csrfName, { sameSite: 'lax', secure: runtimeConfig.secureCookies, path: '/' });
export const cookies = { session: cookieName, csrf: csrfName };
