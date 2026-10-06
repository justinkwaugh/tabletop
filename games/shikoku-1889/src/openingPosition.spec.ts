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
        "2p/1889: c76a29363f1fe152",
        "2p/7: 3c79328456661bcc",
        "3p/1889: 3e8938e2ce024849",
        "3p/7: 57b6ca63ad24ae1d",
        "4p/1889: 5e96a2cc7b17f173",
        "4p/7: a215c44be782ae6f",
        "5p/1889: e306f6954547f7da",
        "5p/7: 2e3509b247226b70",
        "6p/1889: 8bb6d6438a8a6696",
        "6p/7: 509718a2eccaf946",
      ]
    `)
})
