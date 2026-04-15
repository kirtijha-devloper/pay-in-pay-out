const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const rootDir = path.resolve(__dirname, '..');
const schemaPath = path.join(rootDir, 'prisma', 'schema.prisma');
const generatedDir = path.join(rootDir, 'node_modules', '.prisma', 'client');
const generatedSchemaPath = path.join(generatedDir, 'schema.prisma');
const generatedIndexPath = path.join(generatedDir, 'index.js');

function fileExists(filePath) {
  return fs.existsSync(filePath);
}

function hasGeneratedClient() {
  return fileExists(generatedIndexPath) && fileExists(generatedSchemaPath);
}

function isGeneratedClientCurrent() {
  if (!hasGeneratedClient()) return false;
  const sourceSchemaStat = fs.statSync(schemaPath);
  const generatedSchemaStat = fs.statSync(generatedSchemaPath);
  return generatedSchemaStat.mtimeMs >= sourceSchemaStat.mtimeMs;
}

if (isGeneratedClientCurrent()) {
  console.log('Prisma client is already generated and matches the current schema.');
  process.exit(0);
}

const prismaCommand = process.platform === 'win32' ? 'npx.cmd' : 'npx';
const result = spawnSync(prismaCommand, ['prisma', 'generate'], {
  cwd: rootDir,
  stdio: 'inherit',
  env: process.env,
});

process.exit(result.status ?? 1);
