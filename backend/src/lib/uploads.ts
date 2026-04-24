import fs from 'fs';
import path from 'path';

const uploadBaseDir = process.env.VERCEL
  ? process.platform === 'win32'
    ? process.env.TEMP || process.env.TMP || process.cwd()
    : '/tmp'
  : process.cwd();

const uploadRoot = path.join(uploadBaseDir, 'uploads');

export function getUploadRoot() {
  if (!fs.existsSync(uploadRoot)) {
    fs.mkdirSync(uploadRoot, { recursive: true });
  }

  return uploadRoot;
}
