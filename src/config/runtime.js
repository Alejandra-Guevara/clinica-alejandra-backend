// Report configuration errors together, without including credential values.
export function validateRuntimeConfig(env) {
  const errors=[];
  if(!env.SESSION_SECRET || env.SESSION_SECRET.length<32) errors.push('SESSION_SECRET debe tener al menos 32 caracteres (Secret del backend)');
  const port=Number(env.PORT||3000);
  if(!Number.isInteger(port)||port<1||port>65535) errors.push('PORT debe ser un puerto válido');
  if(env.NODE_ENV==='production') {
    if(env.DB_SSL!=='true') errors.push('DB_SSL=true es obligatorio en producción; MySQL debe admitir TLS');
    for(const name of ['DB_HOST','DB_NAME','DB_USER','DB_PASSWORD']) if(!env[name]) errors.push(`${name} debe configurarse para la base de datos remota`);
    if(!env.FRONTEND_URL) errors.push('FRONTEND_URL debe ser el origen HTTPS de la Route del frontend');
    else {
      try {
        const url=new URL(env.FRONTEND_URL);
        if(url.protocol!=='https:'||url.username||url.password||url.origin!==env.FRONTEND_URL) throw new Error('invalid origin');
      } catch { errors.push('FRONTEND_URL debe ser un origen HTTPS, sin ruta ni barra final'); }
    }
  }
  if(errors.length) throw new Error(`Configuración de despliegue incompleta:\n- ${errors.join('\n- ')}`);
}
