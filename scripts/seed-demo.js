import 'dotenv/config';
import bcrypt from 'bcrypt';
import { randomBytes } from 'node:crypto';
import { pool } from '../src/config/db.js';

const database=process.env.DB_NAME||'clinica-alejandra';
if(database!=='clinica_alejandra_demo') {
  console.error('Seguridad: db:demo solo puede ejecutarse contra DB_NAME=clinica_alejandra_demo.');
  process.exitCode=1;
  await pool.end();
} else {
  const connection=await pool.getConnection();
  let generatedPassword=null;
  try {
    await connection.beginTransaction();
    const roles=[['Administrador','Administración global del sistema'],['Médico','Atención clínica autorizada'],['Personal administrativo','Gestión administrativa de pacientes'],['Paciente','Portal del paciente']];
    for(const [name,description] of roles) await connection.execute('INSERT INTO roles(nombre,descripcion) VALUES (?,?) ON DUPLICATE KEY UPDATE descripcion=VALUES(descripcion)',[name,description]);
    const [[adminRole]]=await connection.execute("SELECT id_rol FROM roles WHERE nombre='Administrador'");
    const [[doctorRole]]=await connection.execute("SELECT id_rol FROM roles WHERE nombre='Médico'");

    async function userFor(email,nombres,apellidos,roleId,admin=false) {
      const [[existing]]=await connection.execute('SELECT id_usuario FROM usuarios WHERE email=?',[email]);
      let id=existing?.id_usuario;
      if(!id) {
        const password=admin?(process.env.DEMO_ADMIN_PASSWORD||randomBytes(18).toString('base64url')):randomBytes(32).toString('base64url');
        const [insert]=await connection.execute('INSERT INTO usuarios(nombres,apellidos,email,password_hash,estado) VALUES (?,?,?,?,\'activo\')',[nombres,apellidos,email,await bcrypt.hash(password,12)]);
        id=insert.insertId;
        if(admin&&!process.env.DEMO_ADMIN_PASSWORD) generatedPassword=password;
      }
      await connection.execute('INSERT IGNORE INTO usuario_rol(id_usuario,id_rol) VALUES (?,?)',[id,roleId]);
      return id;
    }
    async function insertIgnore(table,columns,values) {
      const marks=columns.map(()=>'?').join(',');
      await connection.execute(`INSERT IGNORE INTO \`${table}\` (${columns.map((col)=>'`'+col+'`').join(',')}) VALUES (${marks})`,values);
    }
    async function idBy(table,idColumn,whereSql,values) {
      const [[row]]=await connection.execute(`SELECT \`${idColumn}\` AS id FROM \`${table}\` WHERE ${whereSql} LIMIT 1`,values);
      if(!row) throw new Error(`No se pudo recuperar la llave demo de ${table}`);
      return row.id;
    }

    const adminId=await userFor('admin.demo@example.test','Admin','Demostración',adminRole.id_rol,true);
    const doctorProfiles=[
      {email:'laura.pineda@demo.invalid',nombres:'Laura',apellidos:'Pineda Demo',registro:'DEMO-RM-001',especialidad:'Medicina general'},
      {email:'mateo.salas@demo.invalid',nombres:'Mateo',apellidos:'Salas Demo',registro:'DEMO-RM-002',especialidad:'Pediatría'},
      {email:'ines.cardenas@demo.invalid',nombres:'Inés',apellidos:'Cárdenas Demo',registro:'DEMO-RM-003',especialidad:'Dermatología'},
    ];
    const doctors=[];
    for(const doctor of doctorProfiles) {
      const userId=await userFor(doctor.email,doctor.nombres,doctor.apellidos,doctorRole.id_rol);
      await insertIgnore('medicos',['id_usuario','numero_registro_profesional','activo'],[userId,doctor.registro,1]);
      const id=await idBy('medicos','id_medico','id_usuario=?',[userId]);
      await insertIgnore('especialidades',['nombre','descripcion'],[doctor.especialidad,'Especialidad de ejemplo, datos ficticios.']);
      const specialtyId=await idBy('especialidades','id_especialidad','nombre=?',[doctor.especialidad]);
      await insertIgnore('medico_especialidad',['id_medico','id_especialidad'],[id,specialtyId]);
      doctors.push({...doctor,id});
    }

    const patients=[
      {doc:'DEMO-0001',nombres:'Valentina',apellidos:'Montoya Ejemplo',birth:'1994-03-12',sex:'Femenino',phone:'3000000001',email:'valentina.montoya@example.test',blood:'O+'},
      {doc:'DEMO-0002',nombres:'Samuel',apellidos:'Restrepo Ejemplo',birth:'1988-07-24',sex:'Masculino',phone:'3000000002',email:'samuel.restrepo@example.test',blood:'A+'},
      {doc:'DEMO-0003',nombres:'Lucía',apellidos:'Vélez Ejemplo',birth:'2001-11-05',sex:'Femenino',phone:'3000000003',email:'lucia.velez@example.test',blood:'B+'},
      {doc:'DEMO-0004',nombres:'Tomás',apellidos:'Arango Ejemplo',birth:'1979-01-30',sex:'Masculino',phone:'3000000004',email:'tomas.arango@example.test',blood:'AB+'},
      {doc:'DEMO-0005',nombres:'Mariana',apellidos:'Ospina Ejemplo',birth:'2012-06-16',sex:'Femenino',phone:'3000000005',email:'mariana.ospina@example.test',blood:'O-'},
      {doc:'DEMO-0006',nombres:'Nicolás',apellidos:'Quintero Ejemplo',birth:'1966-09-08',sex:'Masculino',phone:'3000000006',email:'nicolas.quintero@example.test',blood:'A-'},
    ];
    const patientIds=[];
    for(let i=0;i<patients.length;i++) {
      const p=patients[i];
      await insertIgnore('pacientes',['id_usuario','tipo_documento','numero_documento','nombres','apellidos','fecha_nacimiento','sexo_registrado','telefono','email','direccion','grupo_sanguineo'],[null,'DEMO',p.doc,p.nombres,p.apellidos,p.birth,p.sex,p.phone,p.email,'Dirección ficticia de demostración',p.blood]);
      const id=await idBy('pacientes','id_paciente','tipo_documento=? AND numero_documento=?',['DEMO',p.doc]);
      patientIds.push(id);
      await insertIgnore('historias_clinicas',['id_paciente','numero_historia','estado'],[id,`DEMO-HC-${String(i+1).padStart(4,'0')}`,'activa']);
    }

    const diagnoses=[
      ['DEMO-Z00.0','Evaluación general de demostración'],['DEMO-J06.9','Síntomas respiratorios de ejemplo'],['DEMO-L30.9','Hallazgo dermatológico ficticio'],
    ];
    for(const [code,name] of diagnoses) await insertIgnore('diagnosticos',['codigo_cie10','nombre','descripcion'],[code,name,'Registro sintético para demostración; no corresponde a un diagnóstico real.']);
    const medicines=[['DEMO-MED-01','Medicamento de muestra A','500 mg','Tableta'],['DEMO-MED-02','Medicamento de muestra B','10 mg/ml','Solución'],['DEMO-MED-03','Crema de muestra','1%','Crema']];
    for(const med of medicines) await insertIgnore('medicamentos',['codigo_catalogo','nombre','concentracion','forma_farmaceutica'],med);
    const exams=[['DEMO-LAB-01','Hemograma de demostración'],['DEMO-LAB-02','Perfil metabólico de demostración'],['DEMO-IMG-01','Imagen diagnóstica de ejemplo']];
    for(const exam of exams) await insertIgnore('examenes',['codigo_catalogo','nombre','descripcion'],[exam[0],exam[1],'Catálogo ficticio de demostración.']);
    for(const [name,type,description] of [['Polen ficticio','ambiental','Alergia sintética de demostración.'],['Fruto seco ficticio','alimento','Alergia sintética de demostración.']]) await insertIgnore('alergias',['nombre','tipo','descripcion'],[name,type,description]);
    for(const name of ['Antecedente ficticio de hipertensión','Antecedente ficticio de migraña']) await insertIgnore('antecedentes',['nombre','descripcion'],[name,'Catálogo sintético para demostración.']);

    const diagnosisIds=[];
    for(const [code] of diagnoses) diagnosisIds.push(await idBy('diagnosticos','id_diagnostico','codigo_cie10=?',[code]));
    const medicineIds=[];
    for(const [code] of medicines) medicineIds.push(await idBy('medicamentos','id_medicamento','codigo_catalogo=?',[code]));
    const examIds=[];
    for(const [code] of exams) examIds.push(await idBy('examenes','id_examen','codigo_catalogo=?',[code]));
    const allergyIds=[];
    for(const [name] of [['Polen ficticio'],['Fruto seco ficticio']]) allergyIds.push(await idBy('alergias','id_alergia','nombre=?',[name]));
    const historyIds=[];
    for(let i=0;i<patientIds.length;i++) historyIds.push(await idBy('historias_clinicas','id_historia','id_paciente=?',[patientIds[i]]));

    const consultationIds=[];
    for(let i=0;i<patients.length;i++) {
      const doctor=doctors[i%doctors.length];
      const marker=`DEMO_SEED:consulta:${i+1}`;
      let [[existing]]=await connection.execute('SELECT id_consulta FROM consultas WHERE observaciones=? LIMIT 1',[marker]);
      if(!existing) {
        const state=i<4?'finalizada':'borrador';
        const [insert]=await connection.execute(`INSERT INTO consultas(id_historia,id_medico,fecha_hora,tipo_consulta,motivo_consulta,enfermedad_actual,anamnesis,revision_sistemas,examen_fisico,analisis_clinico,plan_manejo,observaciones,estado,finalizada_en) VALUES (?,?,DATE_SUB(NOW(),INTERVAL ? DAY),?,?,?,?,?,?,?,?,?,?,${state==='finalizada'?'DATE_ADD(DATE_SUB(NOW(),INTERVAL ? DAY),INTERVAL 45 MINUTE)':'NULL'})`,[
          historyIds[i],doctor.id,30-i,i===0?'primera_vez':'control','Consulta de demostración sin valor clínico.','Síntoma de ejemplo generado para presentar la interfaz.','Antecedentes ficticios; no usar para decisiones de salud.','Sin datos reales.','Examen físico de ejemplo, no clínico.','Contenido sintético.','Plan de demostración únicamente.',marker,state,...(state==='finalizada'?[30-i]:[]),
        ]);
        existing={id_consulta:insert.insertId};
      }
      consultationIds.push(existing.id_consulta);
      await insertIgnore('historia_medico',['id_historia','id_medico','asignado_por','estado'],[historyIds[i],doctor.id,adminId,'activa']);
      const diag=diagnosisIds[i%diagnosisIds.length];
      await insertIgnore('consulta_diagnostico',['id_consulta','id_diagnostico','tipo','observaciones'],[existing.id_consulta,diag,'presuntivo','Asociación ficticia para vista previa.']);
      const [[hasVitals]]=await connection.execute('SELECT id_signos FROM signos_vitales WHERE id_consulta=? LIMIT 1',[existing.id_consulta]);
      if(!hasVitals) await connection.execute('INSERT INTO signos_vitales(id_consulta,presion_sistolica,presion_diastolica,frecuencia_cardiaca,frecuencia_respiratoria,temperatura_c,peso_kg,talla_cm,saturacion_oxigeno_pct) VALUES (?,?,?,?,?,?,?,?,?)',[existing.id_consulta,112+i,72+i,68+i,15+i%4,36.4+(i%4)*0.1,52+i*4,150+i*3,96+i%4]);
      if(i<4) {
        const patientAllergy=allergyIds[i%allergyIds.length];
        await insertIgnore('paciente_alergia',['id_paciente','id_alergia','reaccion','severidad'],[patientIds[i],patientAllergy,'Reacción ficticia de demostración.','leve']);
        const antecedentId=await idBy('antecedentes','id_antecedente','nombre=?',[i%2?'Antecedente ficticio de migraña':'Antecedente ficticio de hipertensión']);
        const [[hasAntecedent]]=await connection.execute('SELECT id_paciente_antecedente FROM paciente_antecedente WHERE id_paciente=? AND id_antecedente=? LIMIT 1',[patientIds[i],antecedentId]);
        if(!hasAntecedent) await connection.execute('INSERT INTO paciente_antecedente(id_paciente,id_antecedente,tipo,detalle) VALUES (?,?,?,?)',[patientIds[i],antecedentId,'personal','Dato ficticio para demostración.']);
      }
      if(i<3) {
        let [[recipe]]=await connection.execute('SELECT id_receta FROM recetas WHERE id_consulta=? AND indicaciones_generales=? LIMIT 1',[existing.id_consulta,'DEMO: receta ficticia']);
        if(!recipe) { const [r]=await connection.execute('INSERT INTO recetas(id_consulta,indicaciones_generales) VALUES (?,?)',[existing.id_consulta,'DEMO: receta ficticia']); recipe={id_receta:r.insertId}; }
        const [[hasLine]]=await connection.execute('SELECT id_receta_detalle FROM receta_detalle WHERE id_receta=? AND id_medicamento=? LIMIT 1',[recipe.id_receta,medicineIds[i]]);
        if(!hasLine) await connection.execute('INSERT INTO receta_detalle(id_receta,id_medicamento,dosis,via_administracion,frecuencia,duracion,cantidad,indicaciones) VALUES (?,?,?,?,?,?,?,?)',[recipe.id_receta,medicineIds[i],'Dosis de muestra','Oral','Según indicación ficticia','3 días','6','Ejemplo no terapéutico.']);
      }
      if(i<3) {
        let [[order]]=await connection.execute('SELECT id_orden FROM ordenes_examen WHERE id_consulta=? AND observaciones=? LIMIT 1',[existing.id_consulta,'DEMO: orden ficticia']);
        if(!order) { const [o]=await connection.execute('INSERT INTO ordenes_examen(id_consulta,observaciones) VALUES (?,?)',[existing.id_consulta,'DEMO: orden ficticia']); order={id_orden:o.insertId}; }
        const examId=examIds[i%examIds.length];
        const [[hasExam]]=await connection.execute('SELECT id_orden_detalle FROM orden_examen_detalle WHERE id_orden=? AND id_examen=? LIMIT 1',[order.id_orden,examId]);
        if(!hasExam) await connection.execute('INSERT INTO orden_examen_detalle(id_orden,id_examen,estado,resultado_resumen,fecha_resultado) VALUES (?,?,?,?,?)',[order.id_orden,examId,'informado','Resultado completamente ficticio para la vista de demostración.',new Date()]);
      }
    }
    await connection.commit();
    console.log(JSON.stringify({message:'Datos sintéticos de demostración cargados de forma idempotente.',database,patients:patients.length,doctors:doctors.length,consultations:consultationIds.length,adminEmail:'admin.demo@example.test',...(generatedPassword?{generatedDemoAdminPassword:generatedPassword}:{})}));
  } catch(error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
    await pool.end();
  }
}
