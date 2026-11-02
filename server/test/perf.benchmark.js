"use strict";
const http = require("http");
const { spawn } = require("child_process");
const path = require("path");

async function runBenchmark() {
  const serverPath = path.join(__dirname, "..", "server.js");
  const env = Object.assign({}, process.env, {
    PORT: "3899",
    NODE_ENV: "test",
    ADMIN_INITIAL_PASSWORD: "BenchmarkAdminPassword123!"
  });

  const child = spawn(process.execPath, [serverPath], { env });

  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("Server start timeout")), 4000);
    child.stdout.on("data", (data) => {
      if (data.toString().includes("server online at http")) {
        clearTimeout(timeout);
        resolve();
      }
    });
    child.stderr.on("data", (err) => console.error(err.toString()));
  });

  function req(endpoint, method = "GET", body = null) {
    return new Promise((resolve, reject) => {
      const start = process.hrtime.bigint();
      const options = {
        hostname: "127.0.0.1",
        port: 3899,
        path: endpoint,
        method: method,
        headers: { "Content-Type": "application/json" }
      };

      const request = http.request(options, (res) => {
        let raw = "";
        res.on("data", (chunk) => (raw += chunk));
        res.on("end", () => {
          const end = process.hrtime.bigint();
          const latencyMs = Number(end - start) / 1e6;
          resolve({ status: res.statusCode, latencyMs, body: raw });
        });
      });

      request.on("error", reject);
      if (body) request.write(JSON.stringify(body));
      request.end();
    });
  }

  try {
    console.log("--- STREAMLAB PERFORMANCE & LATENCY BENCHMARK ---");

    // 1. Health Endpoint Latency
    const health = await req("/api/health");
    console.log(`Endpoint: GET /api/health -> Status: ${health.status}, Latency: ${health.latencyMs.toFixed(2)} ms`);

    // 2. Config Endpoint Latency
    const config = await req("/api/config");
    console.log(`Endpoint: GET /api/config -> Status: ${config.status}, Latency: ${config.latencyMs.toFixed(2)} ms`);

    // 3. TMDB Discover Route Latency (with Kids filter)
    const discover = await req("/api/tmdb/discover?type=movie&kids=true");
    console.log(`Endpoint: GET /api/tmdb/discover (Kids) -> Status: ${discover.status}, Latency: ${discover.latencyMs.toFixed(2)} ms`);

    // 4. TMDB Empty Search Latency
    const search = await req("/api/tmdb/search?query=");
    console.log(`Endpoint: GET /api/tmdb/search (empty) -> Status: ${search.status}, Latency: ${search.latencyMs.toFixed(2)} ms`);

    // 5. Auth Signup Latency (Bcrypt 10 rounds hashing cost)
    const signup = await req("/api/auth/signup", "POST", {
      username: `bench_${Date.now()}`,
      password: "TestPassword123!"
    });
    console.log(`Endpoint: POST /api/auth/signup (Bcrypt 10 rounds) -> Status: ${signup.status}, Latency: ${signup.latencyMs.toFixed(2)} ms`);

    // Measure Node Server Memory Usage
    console.log("Memory Telemetry: Child PID =", child.pid);
  } finally {
    child.kill("SIGINT");
  }
}

runBenchmark().catch((e) => {
  console.error("Benchmark failed:", e);
  process.exit(1);
});
