import http from "node:http";
import { URL } from "node:url";

const port = Number(process.env.PORT ?? 5000);

const server = http.createServer((req, res) => {
  const url = new URL(req.url ?? "", `http://${req.headers.host ?? "localhost"}`);

  res.setHeader("Content-Type", "application/json; charset=utf-8");

  if (req.method === "GET" && url.pathname === "/health") {
    res.writeHead(200);
    res.end(JSON.stringify({ status: "ok", uptime: process.uptime() }));
    return;
  }

  if (req.method === "GET" && url.pathname === "/") {
    res.writeHead(200);
    res.end(JSON.stringify({ message: "Backend server is running", version: "1.0.0" }));
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/drivers") {
    res.writeHead(200);
    res.end(
      JSON.stringify({
        drivers: [
          { id: 1, name: "Alice Driver", status: "active" },
          { id: 2, name: "Bob Driver", status: "inactive" },
        ],
      }),
    );
    return;
  }

  res.writeHead(404);
  res.end(JSON.stringify({ error: "Not found" }));
});

server.listen(port, () => {
  console.log(`Backend server listening at http://localhost:${port}`);
});
