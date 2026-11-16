# Clínica Alejandra · API

API REST Express/MySQL for the supplied schema. `DB_NAME` defaults to the existing XAMPP database `clinica-alejandra`; the original SQL creates `historias_clinicas` for a fresh import. The project never creates, renames or modifies tables automatically.

## Desarrollo local

1. Install Node.js 22 and run `npm install`.
2. Copie `.env.example` a `.env` y configure una base que ya exista, además de `SESSION_SECRET` (32 caracteres aleatorios o más).
3. Set `DB_NAME` to the database that already exists. For local XAMPP, create a dedicated account restricted to localhost and grant only SELECT, INSERT, UPDATE and DELETE on `clinica-alejandra`.*. The supplied SQL includes `CREATE DATABASE IF NOT EXISTS historias_clinicas`; do not import it over an existing clinical database. Import it only into a deliberately selected empty or disposable schema.
4. Manual y necesario para funciones clinicas nuevas: `npm.cmd run db:migrate` aplica migraciones idempotentes. La 001 agrega anulacion y adendas; la 002 crea asignaciones historia-medico; la 003 incorpora `session_version` para revocar sesiones tras cambiar la clave; la 004 elimina la tabla heredada de tokens de recuperacion. No se eliminan datos clinicos.
5. `npm run db:roles`; configure `ADMIN_INITIAL_PASSWORD` temporalmente en el entorno de forma segura y ejecute `npm run admin:create -- admin@ejemplo.com Nombre Apellido`. En PowerShell puede solicitarla sin mostrarla: `$env:ADMIN_INITIAL_PASSWORD = [System.Net.NetworkCredential]::new('', (Read-Host -AsSecureString 'Contraseña inicial')).Password`; al terminar, ejecute `Remove-Item Env:ADMIN_INITIAL_PASSWORD`.
6. `npm run dev`. Health check: `GET /api/health`.

Sesiones en cookies HttpOnly firmadas, CSRF por cookie/header, rate limit de login, roles en cada solicitud, consultas parametrizadas, restricciones relacionales MySQL, auditoria de lecturas/escrituras y bloqueo de edicion de consulta tras finalizacion. El cambio de clave desde el perfil revoca sesiones anteriores. Las sesiones MySQL usan `-05:00` (Colombia), porque los `DATETIME` del esquema no contienen zona horaria. `DB_SSL=true` habilita TLS con verificacion del certificado (configurable con `DB_SSL_CA`); el servidor exige TLS de base de datos y `FRONTEND_URL` en produccion. No se guardan tokens de sesion en localStorage. Para ejecucion local, use una cuenta MariaDB de minimo privilegio; el `.env` no se publica.

## API

- `GET /api/auth/csrf`, `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me` y `PATCH /api/auth/password`.
- `GET /api/dashboard`.
- `GET /api/pacientes/portal/me` vincula una cuenta con su paciente; `GET /api/pacientes/:id/record` también permite al rol Paciente consultar únicamente su propio registro y oculta consultas no finalizadas.
- `GET /api/pacientes/:id/record` entrega la ficha agregada (consultas, diagnósticos, signos vitales, recetas, órdenes, alergias y antecedentes); los médicos solo acceden a historias con asignación activa. Cada apertura queda auditada. `POST /api/pacientes/:id/record/export` registra la acción `exportacion` antes de imprimir y vuelve a validar el acceso. Los eventos detallados solo se muestran a Administradores.
- Consultas: `PATCH /api/consultas/:id/finalizacion` (médico asignado o administrador), `PATCH /api/consultas/:id/anulacion` (solo administrador, motivo requerido) y `GET/POST /api/consultas/:id/adendas` (consultas finalizadas/anuladas; adendas inmutables).
- `POST /api/recetas` crea en transacción la receta y al menos un medicamento; `POST /api/ordenes-examen` crea en transacción la orden y sus exámenes. Ambas acciones requieren consulta en borrador y autorización del médico asignado o rol administrador. No se crean líneas sueltas.
- Recursos: `/api/pacientes`, `/api/medicos`, `/api/especialidades`, `/api/historias-clinicas`, `/api/asignaciones-historia`, `/api/alergias`, `/api/paciente-alergias`, `/api/antecedentes`, `/api/paciente-antecedentes`, `/api/consultas`, `/api/diagnosticos`, `/api/consulta-diagnosticos`, `/api/signos-vitales`, `/api/medicamentos`, `/api/recetas`, `/api/receta-detalles`, `/api/examenes`, `/api/ordenes-examen`, `/api/orden-examen-detalles`.
- Listados aceptan `page`, `limit` (máximo 100), `search` y filtros por campos permitidos. Respuesta `{data,meta}`.
- Usuarios se buscan, listan y paginan con `page`, `limit` y `search` en `/api/usuarios`, y se crean/editan (Administrador); roles tienen GET/POST/PUT/DELETE en `/api/roles` (DELETE protegido por FK).
- Los nombres de los roles base (`Administrador`, `Médico`, `Personal administrativo` y `Paciente`) están protegidos contra renombrado/eliminación para evitar perder el acceso administrativo.
- Auditoría solo Administrador: `GET /api/auditoria-accesos`.

Las recetas y órdenes compuestas usan transacciones y claves foráneas; las líneas de receta se crean junto con su cabecera y no admiten edición o alta independiente. Los detalles de exámenes siguen transiciones permitidas y no admiten alta suelta. La eliminación de registros está deshabilitada en toda la API; los endpoints DELETE responden con HTTP 405. Las historias clínicas se archivan, y la auditoría se conserva. Las consultas finalizadas no admiten edición y pueden recibir adendas inmutables. Anular requiere la migración 001, rol administrador, motivo obligatorio y auditoría. La migración 002 agrega asignación explícita de médicos a historias y conserva vínculos previos mediante una copia derivada de consultas; el acceso inicial se gestiona en `/api/asignaciones-historia`. `npm test` incluye validacion de payloads, migracion, recetas, ordenes, sesiones, liveness HTTP y redaccion de errores internos. La prueba de integración requiere un esquema desechable ya importado y migrado cuyo nombre termine en `_test`; crea registros y usuarios de prueba y no los limpia. Antes de uso clínico real debe revisarse ese modelo y validar identidad profesional.

### Integracion real contra MySQL aislado

La suite integrada comprueba login/cookies, CRUD de pacientes, historias y asignaciones, control por registro, filtros y ordenamiento, relaciones auditadas, diagnosticos en borrador, signos vitales, alergias/antecedentes, recetas y ordenes transaccionales, resultados, finalizacion/anulacion/adendas y portal. La suite crea registros de prueba y no los limpia; use exclusivamente una base desechable cuyo nombre termine en `_test`.

El SQL suministrado comienza con `CREATE DATABASE ... historias_clinicas` y `USE historias_clinicas`. Para preparar `clinica_alejandra_test`, cree primero ese esquema desechable; importe una copia temporal del SQL despues de quitar esas sentencias iniciales. No importe el archivo original sobre la base clinica. Use phpMyAdmin u otro cliente MySQL para seleccionar `clinica_alejandra_test` antes de importar. Prepare un usuario exclusivo de pruebas con permisos solo en ese esquema; no reutilice el usuario de aplicacion ni root para el runtime.

En PowerShell, desde esta carpeta, configure la conexion temporal al esquema de prueba. Se pedira la clave del usuario de prueba sin mostrarla:

```powershell
$env:DB_HOST = '127.0.0.1'
$env:DB_PORT = '3306'
$env:DB_USER = 'clinica_test'
$secureDbPassword = Read-Host -AsSecureString 'Clave del usuario de prueba'
$env:DB_PASSWORD = [System.Net.NetworkCredential]::new('', $secureDbPassword).Password
$env:DB_NAME = 'clinica_alejandra_test'
$env:INTEGRATION_TESTS = '1'
npm.cmd run db:migrate
npm.cmd run test:integration
Remove-Item Env:DB_HOST,Env:DB_PORT,Env:DB_USER,Env:DB_PASSWORD,Env:DB_NAME,Env:INTEGRATION_TESTS
$secureDbPassword.Dispose()
```

No ejecute el runner contra la base activa aunque su nombre termine en `_test`. Al terminar, elimine manualmente solo el esquema desechable despues de verificar su nombre. `npm test` ejecuta las pruebas unitarias y omite la integracion opt-in.
## OpenShift

Despliegue primero esta API y el frontend en el mismo namespace: el Nginx frontend envia `/api` al Service `clinica-alejandra-api:3000` para conservar el mismo origen de cookies. Construya la imagen con el Dockerfile. Configure `FRONTEND_URL` con el origen HTTPS de la Route frontend y `TRUST_PROXY=2` para la cadena Route -> Nginx -> Express (ajuste si cambia la topologia). Configure `PORT`, `NODE_ENV=production`, `COOKIE_SECURE=true`, `DB_SSL=true` como ConfigMap. Guarde credenciales DB, `SESSION_SECRET` aleatorio de al menos 32 caracteres. Si MySQL requiere CA privada, cree Secret `clinica-alejandra-db-ca` con `ca.pem` y defina `DB_SSL_CA=/etc/mysql-ca/ca.pem`; el manifiesto monta ese Secret opcionalmente. Exponga Service puerto 3000 y Route TLS. Conecte a MySQL administrado por red privada; XAMPP local no esta disponible desde el cluster. El contenedor incluye `src`, `scripts` y `migrations`; `/api/health` valida MySQL y `/api/live` valida Express. OpenShift usa health como readiness y live para startup/liveness. Ejecute `npm run db:migrate` manualmente antes de habilitar trafico; no se migra automaticamente. No incluya secretos en imagenes.

## Límites antes de producción

La conexión y el flujo CRUD se probaron en una instancia desechable MySQL Community 8.4.13 importando el SQL suministrado, y la interfaz se recorrió conectada a esa API. La API se verificó contra XAMPP `clinica-alejandra`: migraciones aditivas 001/002/003, health, CSRF y rechazo de credenciales inexistentes. No se importó el SQL ni se borraron o actualizaron filas clínica del usuario. Antes del uso real, endurezca la cuenta root local de XAMPP, configure TLS y revise host/credenciales; revise compatibilidad con `CHECK`, retención, respaldo cifrado, HTTPS, CSRF/orígenes permitidos y auditoría inmutable. Esta implementación no certifica cumplimiento de normativa colombiana ni reemplaza revisión legal/seguridad clínica.


## Respaldo y restauracion

No se generaron dumps de la base del usuario. Para respaldos operativos, use una cuenta separada de solo lectura con los privilegios de dump necesarios; no use `clinica_api` ni `root`. Guarde cada dump solamente en un volumen cifrado y con acceso restringido. No almacene copias en Git, `dist`, OneDrive compartido ni en una carpeta temporal sin cifrar.

En XAMPP puede usar `mysqldump` con el esquema existente; `--password` solicita la clave sin incluirla en el comando. Cambie el destino por una ruta de un volumen cifrado:

```powershell
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
& 'C:\xampp\mysql\bin\mysqldump.exe' --host=127.0.0.1 --user=clinica_backup --password --single-transaction --routines --events --triggers --hex-blob "--result-file=E:\Backups\clinica-alejandra-$stamp.sql" --databases clinica-alejandra
```

Defina con la clinica el calendario, retencion, responsables, RPO/RTO y custodia de claves; la aplicacion no programa respaldos. Verifique cada archivo y registre el resultado sin incluir datos clinicos. Pruebe restauraciones periodicas solo en una instancia aislada con acceso restringido; nunca apunte un comando de restauracion a la base activa como prueba. Documente la fecha, version del motor, resultado y tiempo de restauracion, y elimine copias temporales al terminar conforme a la politica aprobada.


## GitHub

Este backend tiene su propio repositorio Git, independiente del frontend, y actualmente no tiene remoto. Cuando exista el repositorio destino `clinica-alejandra-backend`, configure su URL como `origin`; confirme el propietario antes de publicar cambios.
