# Dice faces

Cut from the attack and defence die textures (2048 × 2048, six cells each) and the end die
(500 × 500). Each distinct face is one JPEG, 144 × 144, named for what the engine's dice
data calls it:

- `attack.{sword,hollow-sword,skull}`: the three attack faces (R-5.5.5). The skull face
  carries its two swords, as on the component.
- `defense.{blank,shield,two-shields,doubling}`: the four defence faces (R-5.5.4). The
  doubling face is a frame round "x2", not a shield.
- `end.{1..6}`: the end die (R-3.3). The "6" is underlined on the component so it cannot be read as a 9.

Each cell was found by its saturated colour and cropped inside the bevel.

## Licensing

Third-party copyrighted art, not covered by the platform's MIT licence. Permission to use it
is on file with the repository owner.
