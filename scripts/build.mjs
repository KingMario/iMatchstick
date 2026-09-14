import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { buildDay, formatBuildId } from "./build-id.mjs";

const sha = execFileSync("git", ["rev-parse", "--short=7", "HEAD"], {
  encoding: "utf8",
}).trim();
let buildId = `local-${Date.now()}`;

if (process.env.GITHUB_ACTIONS) {
  const api = async (path) => {
    const response = await fetch(
      `https://api.github.com/repos/${process.env.GITHUB_REPOSITORY}/${path}`,
      {
        headers: {
          Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
          Accept: "application/vnd.github+json",
        },
      },
    );
    if (!response.ok)
      throw new Error(`GitHub build identity: ${response.status}`);
    return response.json();
  };
  const run = await api(`actions/runs/${process.env.GITHUB_RUN_ID}`);
  const date = buildDay(run.created_at);
  const start = new Date(`${date}T00:00:00+08:00`).toISOString();
  const end = new Date(new Date(start).getTime() + 86400000 - 1).toISOString();
  let sequence = 0;
  for (let page = 1; ; page++) {
    const result = await api(
      `actions/workflows/${run.workflow_id}/runs?per_page=100&page=${page}&created=${encodeURIComponent(`${start}..${end}`)}`,
    );
    sequence += result.workflow_runs.filter(
      (item) => item.run_number <= run.run_number,
    ).length;
    if (result.workflow_runs.length < 100) break;
  }
  if (!sequence) throw new Error("Unable to determine daily build sequence");
  buildId = formatBuildId(
    date,
    sequence,
    Number(process.env.GITHUB_RUN_ATTEMPT ?? 1),
  );
}

execFileSync(process.execPath, ["node_modules/next/dist/bin/next", "build"], {
  stdio: "inherit",
  env: {
    ...process.env,
    NEXT_PUBLIC_BUILD_ID: buildId,
    NEXT_PUBLIC_BUILD_SHA: sha,
  },
});
const worker = readFileSync("public/sw.js", "utf8");
writeFileSync("out/sw.js", worker.replaceAll("__BUILD_ID__", buildId));
writeFileSync("out/version.json", JSON.stringify({ buildId, sha }));
console.info(`Build: ${buildId} · ${sha}`);
