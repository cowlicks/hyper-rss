import { readdir } from 'node:fs/promises';

export async function listDirectories (source) {
  const out = (await readdir(source, { withFileTypes: true }))
    .filter(dirent => dirent.isDirectory())
    .map(dirent => dirent.name);
  return out;
}
