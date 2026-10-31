/**
 * Removes local-only files from the packaged server function.
 *
 * Next.js copies `.env*` into its standalone output, and the traced file list
 * can pick up `storage/` (local uploads) and `data/` (SQLite). Production reads
 * configuration from Netlify environment variables and files from Supabase
 * Storage, so none of these belong in the deployed bundle.
 *
 * Runs after @netlify/plugin-nextjs because plugins execute in netlify.toml order.
 */
const { readdir, rm, stat } = require("node:fs/promises");
const { join } = require("node:path");

const LOCAL_ONLY = [".env", ".env.local", ".env.development", "storage", "data"];

async function exists(target) {
  try {
    await stat(target);
    return true;
  } catch {
    return false;
  }
}

module.exports = {
  async onPostBuild({ constants, utils }) {
    const projectRoot = join(constants.PUBLISH_DIR, "..");
    const functionDirs = [
      join(projectRoot, ".netlify", "functions-internal"),
      join(projectRoot, ".netlify", "functions"),
    ];

    let removed = 0;
    for (const dir of functionDirs) {
      if (!(await exists(dir))) continue;

      for (const entry of await readdir(dir, { withFileTypes: true })) {
        if (!entry.isDirectory()) continue;
        for (const name of LOCAL_ONLY) {
          const target = join(dir, entry.name, name);
          if (await exists(target)) {
            await rm(target, { recursive: true, force: true });
            removed += 1;
          }
        }
      }
    }

    utils.status.show({
      title: "Local-only files stripped",
      summary:
        removed === 0
          ? "No local .env/storage/data files were present in the function bundles."
          : `Removed ${removed} local-only path(s) from the function bundles.`,
    });
  },
};
