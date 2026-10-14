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
        "2p/1889: eb07944933fcfaba",
        "2p/7: 19350bfa4e6ccfbe",
        "3p/1889: c03d93609444022a",
        "3p/7: 6e03f2847133fa79",
        "4p/1889: 742dcf2e0ff17a33",
        "4p/7: dfc3d6b7abf15caf",
        "5p/1889: 866b5f8ffb8219a9",
        "5p/7: 1055aea92f57c101",
        "6p/1889: 53c43aa3c1618b5e",
        "6p/7: 22fdaf8c5ac9c4d5",
      ]
    `)
})
