# Fleeca Vault — FiveM Hacking Simulator

A practice rig for FiveM-style vault hacks. Four browser minigames you can drill
solo or chain together in a full breach run. No install, no backend — pure static
HTML / CSS / JavaScript.

## Hacks
- **Terminal Hack** — Fallout-style password breach (likeness feedback + bracket combos).
- **Circuit Routing** — rotate pipe tiles to route the signal from IN to OUT before the timer.
- **Cipher Decoder** — four packets: hex, morse, atbash and a caesar shift.
- **Pathing** — chain the nearest unvisited node; one wrong pick resets the run.

Plus **Fleeca Full Breach**, which chains all four back-to-back.

## Run locally
Open `index.html` in a browser, or serve the folder with any static server:

```
python -m http.server 5500
```

## Deploy (GitHub Pages)
Push this repo to GitHub, then: **Settings → Pages → Deploy from a branch → `main` / root**.
The site goes live at `https://<username>.github.io/<repo>/`.

---
Unofficial, fan-made practice build. Not affiliated with or endorsed by any game.
