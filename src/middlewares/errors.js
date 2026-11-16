export function notFound(_req, res) { res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Recurso no encontrado' } }); }

export function errorHandler(error, req, res, _next) {
  const invalidData = ['ER_TRUNCATED_WRONG_VALUE','WARN_DATA_TRUNCATED','ER_BAD_NULL_ERROR','ER_DATA_TOO_LONG'].includes(error.code);
  const known = error.status || (error.name === 'ZodError' || invalidData ? 400 : error.code === 'ER_DUP_ENTRY' ? 409 : error.code === 'ER_NO_REFERENCED_ROW_2' || error.code === 'ER_ROW_IS_REFERENCED_2' ? 409 : 500);
  const code = known >= 500 ? 'INTERNAL_ERROR' : error.name === 'ZodError' || invalidData ? 'VALIDATION_ERROR' : error.code === 'ER_DUP_ENTRY' ? 'DUPLICATE' : error.code?.startsWith('ER_') ? 'DATABASE_CONSTRAINT' : error.code || 'INTERNAL_ERROR';
  const message = known >= 500 ? 'Error interno del servidor' : error.name === 'ZodError' ? 'Los datos recibidos no son v\u00e1lidos' : error.code === 'ER_DUP_ENTRY' ? 'El registro ya existe' : error.code?.startsWith('ER_') ? 'La operaci\u00f3n no respeta las relaciones o restricciones de la base de datos' : error.message || 'Error interno';
  if (known >= 500) console.error(JSON.stringify({ level: 'error', code, route: req.path, errorType: error.name, time: new Date().toISOString() }));
  res.status(known).json({ error: { code, message } });
}
