import assert from 'node:assert/strict';
import { test } from 'node:test';
import { validateRuntimeConfig } from '../src/config/runtime.js';

const production={NODE_ENV:'production',PORT:'8080',SESSION_SECRET:'s'.repeat(48),DB_SSL:'true',DB_HOST:'historia-clinica-db',DB_NAME:'clinica-alejandra',DB_USER:'clinic',DB_PASSWORD:'private-value',FRONTEND_URL:'https://clinica.example.com'};

test('accepts OpenShift port and production configuration',()=>{
  assert.doesNotThrow(()=>validateRuntimeConfig(production));
});
test('reports all missing deployment variables in one error without exposing credentials',()=>{
  assert.throws(()=>validateRuntimeConfig({NODE_ENV:'production',DB_PASSWORD:production.DB_PASSWORD}),(error)=>{
    for(const name of ['SESSION_SECRET','DB_SSL','DB_HOST','DB_NAME','DB_USER','FRONTEND_URL']) assert.ok(error.message.includes(name));
    assert.ok(!error.message.includes(production.DB_PASSWORD));
    return true;
  });
});
test('requires an HTTPS origin for cross origin configuration in production',()=>{
  for(const origin of ['http://clinica.example.com','https://clinica.example.com/api','https://clinica.example.com/']) {
    assert.throws(()=>validateRuntimeConfig({...production,FRONTEND_URL:origin}),/FRONTEND_URL/);
  }
});
test('keeps local development available and rejects invalid ports',()=>{
  assert.doesNotThrow(()=>validateRuntimeConfig({SESSION_SECRET:production.SESSION_SECRET}));
  assert.throws(()=>validateRuntimeConfig({...production,PORT:'not-a-port'}),/PORT/);
});
