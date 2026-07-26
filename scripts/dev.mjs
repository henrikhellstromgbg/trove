import { spawn } from "node:child_process";

const commands = [
  ["web", ["run", "dev:web"]],
  ["inngest", ["run", "dev:inngest"]],
];

const children = commands.map(([name, args]) => {
  const child = spawn("pnpm", args, {
    env: process.env,
    stdio: "inherit",
  });
  child.on("error", (error) => {
    console.error(`[dev:${name}] failed to start:`, error.message);
  });
  return { name, child };
});

let stopping = false;

function stop(signal = "SIGTERM") {
  if (stopping) return;
  stopping = true;
  for (const { child } of children) {
    if (child.exitCode === null && child.signalCode === null) child.kill(signal);
  }
}

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => stop(signal));
}

for (const { name, child } of children) {
  child.on("exit", (code, signal) => {
    if (!stopping) {
      console.error(
        `[dev:${name}] exited (${signal ?? `code ${code ?? 1}`}); stopping local stack`
      );
      stop();
    }
  });
}

await Promise.all(
  children.map(
    ({ child }) =>
      new Promise((resolve) => child.on("exit", resolve))
  )
);
