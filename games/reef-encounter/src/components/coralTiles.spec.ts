import { describe, expect, it } from 'vitest'
import { CoralColors } from './colors.js'
import { CoralTiles, faceUp } from './coralTiles.js'

function faces(starfishSideUp: boolean) {
    return CoralTiles.map((tile) => faceUp({ tileId: tile.id, starfishSideUp }))
}

describe('coral tiles', () => {
    it('pair every two corals exactly once', () => {
        const pairs = CoralTiles.map((tile) =>
            [tile.starfishSide.stronger, tile.starfishSide.weaker].sort().join('-')
        )
        expect(new Set(pairs).size).toBe(10)
    })

    it.each([true, false])(
        'make each coral stronger on two tiles (starfish side up: %s)',
        (side) => {
            for (const color of CoralColors) {
                expect(faces(side).filter((face) => face.stronger === color)).toHaveLength(2)
            }
        }
    )

    it('swap both the corals and the algae on the reverse', () => {
        expect(faceUp({ tileId: 7, starfishSideUp: true })).toEqual({
            stronger: 'orange',
            weaker: 'grey',
            largeAlga: 'blue',
            smallAlga: 'green'
        })
        expect(faceUp({ tileId: 7, starfishSideUp: false })).toEqual({
            stronger: 'grey',
            weaker: 'orange',
            largeAlga: 'green',
            smallAlga: 'blue'
        })
    })

    // Rulebook p. 10: a blue cylinder flips three tiles, and a red one after it affects four.
    it('match the rulebook flipping example', () => {
        const blue = faces(true).filter((face) => face.largeAlga === 'blue')
        expect(blue).toHaveLength(3)
        const afterBlue = CoralTiles.map((tile) => {
            const flipped = tile.starfishSide.largeAlga === 'blue'
            return faceUp({ tileId: tile.id, starfishSideUp: !flipped })
        })
        expect(afterBlue.filter((face) => face.largeAlga === 'red')).toHaveLength(4)
    })
})
