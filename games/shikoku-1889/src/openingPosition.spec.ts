import { expect, it } from 'vitest'
import { openingPositionDigest } from '../../../libs/18xx/test/openingPosition.js'
import { Definition } from './definition/gameDefinition.js'

it('sets up the same opening position for the same seed and player count', () => {
    expect(
        [2, 3, 4, 5, 6].flatMap((players) =>
            [1889, 7].map(
                (seed) => `${players}p/${seed}: ${openingPositionDigest(Definition, players, seed)}`
            )
        )
    ).toMatchInlineSnapshot(`
      [
        "2p/1889: 17fd390f15142012",
        "2p/7: 1ff3be06c5d37919",
        "3p/1889: 1658703c3628c68f",
        "3p/7: 2623aaa93d9189d4",
        "4p/1889: b35ca0447a87132b",
        "4p/7: 0dcace780cbd0976",
        "5p/1889: e5accdaa5a45fb85",
        "5p/7: f510df0a525ebe36",
        "6p/1889: a2500ce3ac8666e3",
        "6p/7: 4edcd569e0612946",
      ]
    `)
})
