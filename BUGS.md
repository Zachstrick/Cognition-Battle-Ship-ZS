# Battleship debugging notes

| Bug found | Fix | How it was verified |
| --- | --- | --- |
| Starting a game with the keyboard could focus a target below the fold without scrolling to it. | Let the browser scroll when moving focus to the first target. | At a 1000 × 400 viewport in Chrome, Enter started the game and brought A1 into view. A second Enter fired and drew one AI reply. |
| Forced-colors mode made ships look like empty water and hits look like sunk squares. | Added distinct symbols to tiles and the legend: ■ ship, • miss, × hit, ⊗ sunk. | In Chrome's forced-colors emulation, sinking the Destroyer changed both tiles to ⊗ and reduced the enemy count to four. |

Browser testing also checked the narrow mobile layout, rejected duplicate and rapid shots, and reset the game while an AI move was pending. The automated rules tests cover fleet placement, hidden ships, turn order, and both win and loss outcomes.
