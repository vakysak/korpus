import express from "express";

const app = express();
const port = Number(process.env.PORT || 3000);

app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "korpus", domain: "vakysak.cz" });
});

app.get("/", (_req, res) => {
  res.type("html").send(`<!doctype html>
<html lang="cs">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Korpus</title>
  <style>
    :root { color-scheme: light; --bg:#1c1917; --fg:#fafaf9; --accent:#c4a574; }
    * { box-sizing: border-box; }
    body { margin:0; min-height:100vh; display:grid; place-items:center;
      font-family: "Iowan Old Style", "Palatino Linotype", Palatino, Georgia, serif;
      background: radial-gradient(1200px 600px at 20% 0%, #3f3a34 0%, var(--bg) 55%);
      color: var(--fg); }
    main { text-align:center; padding:2rem; }
    h1 { font-size: clamp(3rem, 10vw, 5.5rem); letter-spacing:0.04em; margin:0 0 0.4rem; font-weight:600; }
    p { margin:0; opacity:0.8; font-size:1.1rem; }
    .dot { color: var(--accent); }
  </style>
</head>
<body>
  <main>
    <h1>Korpus<span class="dot">.</span></h1>
    <p>Cabinet ERP — vakysak.cz</p>
  </main>
</body>
</html>`);
});

app.listen(port, "0.0.0.0", () => {
  console.log(`korpus listening on ${port}`);
});
