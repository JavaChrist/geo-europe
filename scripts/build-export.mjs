// Export statique destiné à Capacitor, sans dépendance pour passer la variable sous Windows.
import { spawnSync } from "node:child_process";

const result = spawnSync(process.execPath, ["node_modules/next/dist/bin/next", "build"], {
  stdio: "inherit",
  env: { ...process.env, BUILD_TARGET: "export" },
});

process.exit(result.status ?? 1);
