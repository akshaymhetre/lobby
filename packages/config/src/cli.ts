/**
 * Lobby configuration as code.
 *
 *   pnpm --filter @lobby/config exec tsx src/cli.ts export [file]          write the configuration as YAML (stdout when no file)
 *   pnpm --filter @lobby/config exec tsx src/cli.ts apply <file> --dry-run show what would change, write nothing
 *   pnpm --filter @lobby/config exec tsx src/cli.ts apply <file>           apply it
 *
 * Uses DATABASE_URL (default postgres://lobby:lobby@localhost:4132/lobby) and LOBBY_SECRET like the app.
 * Paths are resolved from the directory you ran pnpm in (INIT_CWD), not from packages/config.
 * Exit codes: 0 done, 1 the file has errors, 2 usage.
 */
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { pg } from "@lobby/db";
import { applyImport, exportConfig, planImport, type ImportPlan } from "./index";

const resolve = (p: string) => path.resolve(process.env.INIT_CWD ?? process.cwd(), p);

function printPlan(plan: ImportPlan) {
  for (const s of plan.sections) {
    const parts = [`${s.created.length} to create`, `${s.updated.length} to update`, `${s.unchanged} unchanged`];
    if (s.removed.length) parts.push(`${s.removed.length} to remove`);
    console.log(`${s.label}: ${parts.join(", ")}`);
    for (const c of s.created) console.log(`  + ${c}`);
    for (const u of s.updated) console.log(`  ~ ${u.key} (${u.changes.join(", ")})`);
    for (const r of s.removed) console.log(`  - ${r}`);
  }
  for (const e of plan.errors) console.error(`error: ${e}`);
}

async function main() {
  const [cmd, file, ...rest] = process.argv.slice(2);
  if (cmd === "export") {
    const yaml = await exportConfig();
    if (file) {
      await writeFile(resolve(file), yaml);
      console.error(`Wrote ${resolve(file)}`);
    } else process.stdout.write(yaml);
    return 0;
  }
  if (cmd === "apply" && file) {
    const yaml = await readFile(resolve(file), "utf8");
    if (rest.includes("--dry-run")) {
      const plan = await planImport(yaml);
      printPlan(plan);
      if (plan.errors.length) return 1;
      console.log(plan.hasChanges ? "Dry run: nothing was written." : "No changes. Lobby already matches this file.");
      return 0;
    }
    const result = await applyImport(yaml, null);
    printPlan(result);
    if (result.errors.length) return 1;
    console.log(result.applied ? "Applied." : "No changes. Lobby already matches this file.");
    return 0;
  }
  console.error("Usage: cli.ts export [file] | apply <file> [--dry-run]");
  return 2;
}

main()
  .then(async (code) => {
    await pg.end({ timeout: 5 });
    process.exit(code);
  })
  .catch(async (err) => {
    console.error(err instanceof Error ? err.message : err);
    await pg.end({ timeout: 5 });
    process.exit(1);
  });
