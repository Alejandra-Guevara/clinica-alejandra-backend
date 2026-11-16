import { pool } from '../config/db.js';
import { cookies, readSession } from '../utils/session.js';
import { httpError } from '../utils/http.js';

export async function authenticate(req, _res, next) {
  try {
    const session = readSession(req.cookies?.[cookies.session]);
    if (!session) throw httpError(401, 'Inicia sesión para continuar', 'UNAUTHENTICATED');
    const [rows] = await pool.execute(
      `SELECT u.id_usuario, u.nombres, u.apellidos, u.email, u.estado, u.session_version,
              COALESCE(GROUP_CONCAT(r.nombre ORDER BY r.nombre SEPARATOR ','), '') AS roles
       FROM usuarios u LEFT JOIN usuario_rol ur ON ur.id_usuario=u.id_usuario
       LEFT JOIN roles r ON r.id_rol=ur.id_rol
       WHERE u.id_usuario=? GROUP BY u.id_usuario`, [session.sub]);
    const user = rows[0];
    if(Number(session.sv)!==Number(user?.session_version))throw httpError(401,'La sesión fue revocada','SESSION_REVOKED');
    if (!user || user.estado !== 'activo') throw httpError(401, 'La sesión no está activa', 'SESSION_INVALID');
    const {session_version:_sessionVersion,...publicUser}=user;
    req.user = { ...publicUser, roles: user.roles ? user.roles.split(',') : [] };
    next();
  } catch (error) { next(error); }
}

export const allowRoles = (...roles) => (req, _res, next) => {
  if (!req.user?.roles?.some((role) => roles.includes(role))) return next(httpError(403, 'No tienes permiso para esta acción', 'FORBIDDEN'));
  next();
};

export function requireCsrf(req, _res, next) {
  const cookie = req.cookies?.[cookies.csrf];
  const header = req.get('x-csrf-token');
  if (!cookie || !header || cookie.length !== header.length || !Buffer.from(cookie).equals(Buffer.from(header))) {
    return next(httpError(403, 'Token CSRF inválido o ausente', 'CSRF_INVALID'));
  }
  next();
}
