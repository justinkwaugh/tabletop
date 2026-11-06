import { describe, expect, it } from 'vitest'
import { RegionIds, type RegionId, type TileId } from '../data/regionTiles.js'
import type { Epoch } from '../data/tracks.js'
import { initialState } from '../testing/state.js'
import { canCoverWithWildTiles, spendWildTiles } from './payments.js'
import {
    earlierTileCandidates,
    improvementTile,
    isTileLegal,
    legalStackRegions,
    stackTop,
    tileById,
    tileVp
} from './regionStacks.js'

type Tops = Partial<Record<RegionId, TileId[]>>

/** Stacks as given; a region not named is empty. */
function withStacks(epoch: Epoch, tops: Tops) {
    const state = initialState()
    state.epoch = epoch
    for (const region of RegionIds) {
        state.regionStacks[region] = tops[region] ?? []
    }
    return state
}

describe('R-4.3.1 legal and prohibited tiles', () => {
    it.each([
        { epoch: 1, tile: 'tile.sea.i', legal: true },
        { epoch: 1, tile: 'tile.sea.ii', legal: false },
        { epoch: 1, tile: 'tile.sea.iv', legal: false },
        { epoch: 2, tile: 'tile.sea.i', legal: true },
        { epoch: 2, tile: 'tile.sea.ii', legal: true },
        { epoch: 2, tile: 'tile.sea.iii', legal: false },
        { epoch: 3, tile: 'tile.sea.iii', legal: true },
        { epoch: 3, tile: 'tile.sea.iv', legal: false },
        { epoch: 4, tile: 'tile.sea.iv', legal: true }
    ] as const)('in epoch $epoch, $tile: $legal', ({ epoch, tile, legal }) => {
        expect(isTileLegal(epoch, tileById(tile))).toBe(legal)
    })

    it('reads the top of a stack, epoch I first', () => {
        const state = initialState()
        for (const region of RegionIds) {
            expect(stackTop(state, region)?.epoch).toBe(1)
        }
        state.regionStacks.sea = []
        expect(stackTop(state, 'sea')).toBeUndefined()
    })

    it('R-4.11.1 finds the stacks whose top is legal', () => {
        expect(
            legalStackRegions(
                withStacks(2, {
                    sea: ['tile.sea.i'],
                    island: ['tile.island.ii'],
                    forest: ['tile.forest.iii'],
                    desert: []
                })
            )
        ).toEqual(['sea', 'island'])
        expect(legalStackRegions(withStacks(1, { sea: ['tile.sea.ii'] }))).toEqual([])
    })
})

describe('R-4.3.2 the tile an improvement takes', () => {
    it('a legal top is the tile', () => {
        const state = withStacks(2, { sea: ['tile.sea.ii', 'tile.sea.iii'] })
        expect(improvementTile(state, 'sea')).toEqual({
            kind: 'legal',
            tile: tileById('tile.sea.ii')
        })
    })

    it.each([
        { tile: 'tile.sea.i', farm: 2, town: 3, feudum: 4 },
        { tile: 'tile.sea.ii', farm: 3, town: 4, feudum: 5 },
        { tile: 'tile.sea.iii', farm: 4, town: 5, feudum: 6 },
        { tile: 'tile.sea.iv', farm: 5, town: 6, feudum: 7 }
    ] as const)('scores $tile from the chart', ({ tile, farm, town, feudum }) => {
        expect(tileVp(tileById(tile), 'farm')).toBe(farm)
        expect(tileVp(tileById(tile), 'town')).toBe(town)
        expect(tileVp(tileById(tile), 'feudum')).toBe(feudum)
    })
})

describe('R-4.3-H1 the candidates when the tile is prohibited', () => {
    it('R-1.4-H2 names the stack a tile tops, not the region printed on it', () => {
        const state = withStacks(2, { sea: ['tile.sea.iii'], island: ['tile.forest.i'] })
        expect(earlierTileCandidates(state, 'sea')).toEqual([
            { stack: 'island', tile: tileById('tile.forest.i') }
        ])
    })

    it('none in epoch I, always', () => {
        const state = withStacks(1, {
            sea: ['tile.sea.ii'],
            island: ['tile.island.i'],
            forest: ['tile.forest.i']
        })
        expect(earlierTileCandidates(state, 'sea')).toEqual([])
        expect(improvementTile(state, 'sea')).toEqual({ kind: 'prohibited', candidates: [] })
    })

    it('another stack topped by a tile earlier than the current epoch', () => {
        const state = withStacks(3, {
            sea: ['tile.sea.iv'],
            island: ['tile.island.ii'],
            forest: ['tile.forest.iii'],
            desert: ['tile.desert.i', 'tile.desert.ii'],
            badlands: ['tile.badlands.iv']
        })
        expect(improvementTile(state, 'sea')).toEqual({
            kind: 'prohibited',
            candidates: [
                { stack: 'island', tile: tileById('tile.island.ii') },
                { stack: 'desert', tile: tileById('tile.desert.i') }
            ]
        })
    })

    it('a tile of the current epoch is not earlier', () => {
        const state = withStacks(2, {
            sea: ['tile.sea.iii'],
            island: ['tile.island.ii'],
            forest: ['tile.forest.ii']
        })
        expect(earlierTileCandidates(state, 'sea')).toEqual([])
    })

    it('a tile under the top is out of reach', () => {
        const state = withStacks(3, {
            sea: ['tile.sea.iv'],
            island: ['tile.island.iii', 'tile.island.iv']
        })
        expect(earlierTileCandidates(state, 'sea')).toEqual([])
    })

    it("an improved region's own stack is never a candidate", () => {
        const state = withStacks(3, { sea: ['tile.sea.i'], island: ['tile.island.ii'] })
        expect(earlierTileCandidates(state, 'sea')).toEqual([
            { stack: 'island', tile: tileById('tile.island.ii') }
        ])
    })

    it('R-1.2.5 an empty stack shows its printed V, so its tile is prohibited', () => {
        const state = withStacks(4, { island: ['tile.island.iii'], forest: ['tile.forest.iv'] })
        expect(improvementTile(state, 'sea')).toEqual({
            kind: 'prohibited',
            candidates: [{ stack: 'island', tile: tileById('tile.island.iii') }]
        })
    })
})

describe('R-4.3.3, R-4.4-H1 a collected tile is wild', () => {
    it('R-4.4-H1 is offered when a payment would otherwise fall short', () => {
        const state = withStacks(1, {})
        const player = state.getPlayerState('p1')
        player.regionTiles = ['tile.sea.i']
        player.goods.iron = 0
        state.supply.haversack.iron = 1

        expect(canCoverWithWildTiles(state, 'p1', { iron: 1 })).toBe(true)
        player.regionTiles = []
        expect(canCoverWithWildTiles(state, 'p1', { iron: 1 })).toBe(false)
    })

    it('R-4.3.3 leaves the game when it is spent', () => {
        const state = withStacks(1, {})
        const player = state.getPlayerState('p1')
        player.regionTiles = ['tile.sea.i']
        state.supply.haversack.iron = 1

        spendWildTiles(state, 'p1', [{ tileId: 'tile.sea.i', good: 'iron' }])

        expect(player.regionTiles).toEqual([])
        expect(state.tilesOutOfGame).toContain('tile.sea.i')
    })
})
