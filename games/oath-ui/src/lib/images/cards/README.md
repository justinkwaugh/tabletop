# Card images

One JPEG per card front, named by its card id, which is the only join key between an image,
its data row and game state:

- Denizens, 381 × 596, in one folder per suit: `arcane/denizen.arcane.alchemist.jpg`.
  Ancient Binding's scan is 325 × 508 and is drawn at the same width as the rest.
- Edifices, 381 × 596, in their suit's folder, one card id per edifice: the intact side under the
  id (`nomad/edifice.nomad.ancient-forge.jpg`), the ruined side with `.ruined`
  (`nomad/edifice.nomad.ancient-forge.ruined.jpg`). The side drawn is the one the game state shows
  (`cardImageInPlay`).
- Sites, 770 × 596: `site.the-tribunal.jpg`.
- Relics, 381 × 381: `relic.grand-scepter.jpg`.
- Visions, 1016 × 651: `vision.conquest.jpg`.

The backs are in `../backs/`.

## Licensing

Third-party copyrighted art, not covered by the platform's MIT licence. Permission to use it
is on file with the repository owner.
