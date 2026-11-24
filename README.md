# Battleship — Fleet Command

[Play Battleship online](https://zachstrick.github.io/Cognition-Battle-Ship-ZS/) against a tactical computer opponent. No account, install, or API key required.

## How to play

1. Shuffle your fleet if you want a different starting formation, then select **Start battle**.
2. Pick an unmarked square in **Enemy waters**. Red pegs mark hits and white pegs mark misses. You and the computer alternate one shot at a time.
3. Sink all five opposing ships before the computer sinks yours. Select **Review board** to inspect the final positions or **Play again** to start over.

With a keyboard, use the arrow keys to move around the targeting grid and Enter or Space to fire.

## How the AI works

The computer does not see your ship positions. It searches unfired squares in a checkerboard pattern until it hits a ship, then targets neighboring squares. When hits line up, it prioritizes extending that line. After sinking a ship, it returns to hunting unless another unresolved hit remains.

## Run locally

```sh
python3 -m http.server 8000 --bind 127.0.0.1
```

Open [localhost:8000](http://localhost:8000). The game uses native JavaScript modules, so serve it over HTTP rather than opening the HTML as a local file. Run the dependency-free game tests with `node --test` (Node.js 24 in CI).

See the [debugging notes](BUGS.md) for the bugs found and fixed during development.

## Code and hosting

[`game.mjs`](game.mjs) handles fleet placement, game rules, and AI targeting. [`app.mjs`](app.mjs) handles the boards, input, and effects. GitHub Pages serves the static files from the root of `main`; there is no backend or build step.
