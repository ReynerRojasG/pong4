import { spawnSync } from 'node:child_process';
import { readdir } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = fileURLToPath(new URL('../', import.meta.url));
const sourceRoots = ['src', 'server', 'shared', 'scripts', 'test'];
const javascriptExtensions = new Set(['.js', '.mjs', '.cjs']);

async function collectJavaScriptFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const entryPath = join(directory, entry.name);

    if (entry.isDirectory()) {
      files.push(
        ...await collectJavaScriptFiles(entryPath)
      );
      continue;
    }

    if (javascriptExtensions.has(extname(entry.name))) {
      files.push(entryPath);
    }
  }

  return files;
}

const files = (
  await Promise.all(
    sourceRoots.map((directory) =>
      collectJavaScriptFiles(join(projectRoot, directory))
    )
  )
).flat().sort();

for (const file of files) {
  const result = spawnSync(
    process.execPath,
    ['--check', file],
    { stdio: 'inherit' }
  );

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

console.log(
  `Syntax OK: ${files.length} JavaScript files.`
);
