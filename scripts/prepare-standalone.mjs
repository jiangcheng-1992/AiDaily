import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  rmSync,
  statSync,
} from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const standaloneDir = join(root, ".next", "standalone");

function copyIfExists(from, to) {
  if (!existsSync(from)) return;
  rmSync(to, { recursive: true, force: true });
  mkdirSync(to, { recursive: true });

  for (const entry of readdirSync(from)) {
    copyRecursive(join(from, entry), join(to, entry));
  }
}

function copyRecursive(from, to) {
  const stats = statSync(from);

  if (stats.isDirectory()) {
    mkdirSync(to, { recursive: true });

    for (const entry of readdirSync(from)) {
      copyRecursive(join(from, entry), join(to, entry));
    }

    return;
  }

  mkdirSync(join(to, ".."), { recursive: true });
  copyFileSync(from, to);
}

if (existsSync(standaloneDir)) {
  copyIfExists(join(root, ".next", "static"), join(standaloneDir, ".next", "static"));
  copyIfExists(join(root, "public"), join(standaloneDir, "public"));
}
