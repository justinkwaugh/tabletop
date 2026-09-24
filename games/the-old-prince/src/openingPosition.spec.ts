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
        "3p/1871: 24c7164fe672f883",
        "3p/7: de3deecb4f8b809a",
        "4p/1871: 32810cd05c49f9dc",
        "4p/7: 683be89b76b85994",
      ]
    `)
})
