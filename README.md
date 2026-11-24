# Battleship — Fleet Command

Play classic Battleship against a tactical computer opponent. No account, install, or API key required.

1. Shuffle your fleet if you want a different starting formation, then select **Start battle**.
2. Pick a square on the enemy board. You and the computer take one shot each per turn.
3. Sink all five opposing ships to win. Use **New game** to begin another match.

With a keyboard, use the arrow keys to move around the targeting grid and Enter or Space to fire.

## Run locally

```sh
python3 -m http.server 8000
```

Open [localhost:8000](http://localhost:8000). The game uses native JavaScript modules, so serve it over HTTP rather than opening the HTML as a local file. Run the dependency-free game tests with `node --test` (Node.js 24 in CI).

## How it works

`game.mjs` owns fleet placement, shot resolution, and turn state. The computer sees only the results of its own shots: it searches a checkerboard pattern until it hits a ship, then prioritizes neighboring squares and extends a line of hits. `app.mjs` renders the boards and handles browser input. The site has no server-side game state.

## Hosting

The repository is a static site. GitHub Pages can publish it from the root of the `main` branch without a build step.
