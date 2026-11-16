import 'dotenv/config';
import app from './app.js';
import { pool } from './config/db.js';

const port=Number(process.env.PORT||3000);
if (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 32) throw new Error('SESSION_SECRET debe configurarse con al menos 32 caracteres');
if (process.env.NODE_ENV === 'production' && process.env.DB_SSL !== 'true') throw new Error('DB_SSL=true es obligatorio en producción');
if (process.env.NODE_ENV === 'production' && !process.env.FRONTEND_URL) throw new Error('FRONTEND_URL es obligatorio en producción');
const server=app.listen(port,'0.0.0.0',()=>console.log(JSON.stringify({level:'info',message:'API listening',port,time:new Date().toISOString()})));
for(const signal of ['SIGINT','SIGTERM']) process.on(signal,()=>server.close(async()=>{await pool.end();process.exit(0);}));
