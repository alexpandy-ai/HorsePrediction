import { spawn } from "node:child_process";

const children = [
  spawn("npx", ["tsx", "server/index.ts"], { stdio: "inherit", shell: true }),
  spawn("npx", ["vite"], { stdio: "inherit", shell: true }),
];

function stop() {
  for (const child of children) child.kill();
}

process.on("SIGINT", stop);
process.on("SIGTERM", stop);
