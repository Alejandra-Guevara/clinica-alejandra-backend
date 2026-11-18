# Backend de Red Hat

El manifiesto `openshift-backend.yaml` actualiza el servicio Knative existente `clinica-alejandra-backend-git` en `maria-guevara-rio-dev`. No crea otro Deployment de API.

Usa el Secret `clinica-alejandra-backend-secret` con `SESSION_SECRET`, `DB_USER` y `DB_PASSWORD`. Las demás variables se toman de `clinica-alejandra-api-config`. El Secret se prepara en la consola y no se publica en GitHub. Verifica DB_NAME y que MySQL ofrezca TLS; la contraseña de MySQL es independiente de la cuenta del administrador de la aplicación.

La URL del frontend está declarada de antemano en la Route del frontend y en `FRONTEND_URL`. El puerto 8080 se publica en el contenedor; Knative inyecta `PORT` con ese valor. Las sondas HTTP diferencian el estado de Express del estado de MySQL.

El arranque informa todas las variables obligatorias faltantes en un solo mensaje. La sonda de base de datos registra únicamente el código del error de conexión, sin credenciales ni sentencias SQL. `DB_SSL=true` sigue siendo obligatorio en producción; si se necesita una CA privada, monta `ca.pem` con el Secret opcional `clinica-alejandra-db-ca` y configura `DB_SSL_CA=/etc/mysql-ca/ca.pem`.

Para aplicar y reconstruir ambos repositorios, usa el [procedimiento completo del frontend](https://github.com/Alejandra-Guevara/clinica-alejandra-frontend/blob/main/deploy/README.md). El script conserva una sola API, actualiza su imagen por digest y conecta el proxy del frontend con la revisión lista. El YAML completo está en `deploy/redhat-completo.yaml` del repositorio frontend.

El despliegue no crea ni importa tablas, no ejecuta el seed y no modifica contraseñas. Para una base recién importada, aplica las migraciones manualmente con una cuenta autorizada para DDL antes de usar los módulos clínicos. El cargador demo existente conserva su restricción de ejecución local.
