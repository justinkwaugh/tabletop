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
        "3p/1871: 90f07cb1c5d59cac",
        "3p/7: 495e69222b5daddf",
        "4p/1871: a30ac193821f0eff",
        "4p/7: 3c9e74e8d2b6404f",
      ]
    `)
})
