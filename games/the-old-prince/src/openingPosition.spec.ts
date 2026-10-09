import { expect, it } from 'vitest'
import { openingPositionDigest } from '../../../libs/18xx/test/openingPosition.js'
import { Definition } from './definition/gameDefinition.js'

it('sets up the same opening position for the same seed and player count', () => {
    expect(
        [3, 4].flatMap((players) =>
            [1871, 7].map(
                (seed) => `${players}p/${seed}: ${openingPositionDigest(Definition, players, seed)}`
            )
        )
    ).toMatchInlineSnapshot(`
      [
        "3p/1871: 64fed59a50c687ba",
        "3p/7: 36d8eb7037e650a3",
        "4p/1871: 265aeccdb533fc1c",
        "4p/7: 4eb5c1a5e54b1052",
      ]
    `)
})
