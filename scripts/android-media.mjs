// Déplace les photos de l'export (assets de l'application Android) vers le pack d'assets Play `media_pack`.
// À lancer après `npx cap sync android`. Les photos gardent le même chemin (`public/media/...`) :
// la WebView les lit par l'AssetManager, qui fusionne le module de base et les packs install-time.
import { existsSync, mkdirSync, renameSync, rmSync, readdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";

const from = "android/app/src/main/assets/public/media";
const to = "android/media_pack/src/main/assets/public/media";

if (!existsSync(from)) {
  console.error(`Aucune photo dans ${from} : lancer d'abord npm run build:export puis npx cap sync android.`);
  process.exit(1);
}
rmSync(to, { recursive: true, force: true });
mkdirSync(dirname(to), { recursive: true });
renameSync(from, to);

const size = (dir) =>
  readdirSync(dir).reduce((sum, name) => {
    const path = join(dir, name);
    const info = statSync(path);
    return sum + (info.isDirectory() ? size(path) : info.size);
  }, 0);
const mb = (bytes) => `${(bytes / 1024 / 1024).toFixed(1)} Mo`;
console.log(`Pack media_pack : ${mb(size(to))}. Application de base : ${mb(size("android/app/src/main/assets/public"))}.`);
