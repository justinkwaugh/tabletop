import { describe, expect, it } from 'vitest'
import { improveOffers } from '../actions/improve.js'
import { RegionIds, type RegionId, type TileId } from '../data/regionTiles.js'
import type { Epoch } from '../data/tracks.js'
import { ActionType } from '../definition/actions.js'
import { MachineState } from '../definition/states.js'
import {
    giveGood,
    giveSeal,
    setUp,
    tableImproving,
    type ImprovingTable
} from '../testing/improving.js'
import { initialState } from '../testing/state.js'
import { triggeredEpoch } from './epochConditions.js'
import type { HydratedFeudumGameState } from './gameState.js'
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

describe('R-4.3.2 the tile Improve takes', () => {
    /** The seat rules a farm and holds an iron; `stacks` then sets the epoch and the tops. */
    function atFarm(stacks: (state: HydratedFeudumGameState, region: RegionId) => void = () => {}) {
        const start = tableImproving('farm')
        setUp(start.table, (state) => {
            stacks(state, start.region)
        })
        return start
    }

    /** Takes tiles off a stack until the one of this epoch shows. */
    function uncover(state: HydratedFeudumGameState, region: RegionId, epoch: Epoch): void {
        while ((stackTop(state, region)?.epoch ?? epoch) < epoch) {
            const removed = state.regionStacks[region].shift()
            if (removed) {
                state.tilesOutOfGame.push(removed)
            }
        }
    }

    const send = (start: ImprovingTable, more = {}) =>
        start.table.send(start.playerId, {
            type: ActionType.Improve,
            spaceId: start.spaceId,
            discId: 'disc.double.1',
            ...more
        })

    it.each([
        { epoch: 1, vp: 3 },
        { epoch: 2, vp: 4 },
        { epoch: 3, vp: 5 },
        { epoch: 4, vp: 6 }
    ] as const)('takes a legal top tile of epoch $epoch, for $vp vp as a town', ({ epoch, vp }) => {
        const start = atFarm((state, region) => {
            state.epoch = epoch
            uncover(state, region, epoch)
        })
        const before = start.table.hydrated()
        const tileId = before.regionStacks[start.region][0]
        const landscape = before.requireVault().tileLandscapes[tileId]
        const score = before.getPlayerState(start.playerId).score

        const [action] = send(start)

        const after = start.table.hydrated()
        const seat = after.getPlayerState(start.playerId)
        expect(seat.regionTiles).toEqual([tileId])
        expect(seat.score).toBe(score + vp)
        expect(after.regionStacks[start.region]).not.toContain(tileId)
        expect(action).toMatchObject({ metadata: { tile: { tileId, landscape, vp } } })
    })

    it.each([
        { from: 'outpost', to: 'farm', vp: 2, more: { discId: 'disc.double.1' } },
        { from: 'town', to: 'feudum', vp: 4, more: { feudumGuild: 'noble' } }
    ] as const)(
        'R-3.9.2, R-4.3.2 $from to $to scores the epoch I tile by its $to column, $vp vp',
        ({ from, vp, more }) => {
            const start = tableImproving(from)
            setUp(start.table, (state) => {
                giveGood(state, start.playerId, 'wood')
                giveSeal(state, start.playerId)
            })
            const before = start.table.hydrated()
            const tileId = before.regionStacks[start.region][0]
            const score = before.getPlayerState(start.playerId).score

            const [action] = start.table.send(start.playerId, {
                type: ActionType.Improve,
                spaceId: start.spaceId,
                ...more
            })

            const seat = start.table.hydrated().getPlayerState(start.playerId)
            expect(seat.regionTiles).toEqual([tileId])
            expect(seat.score).toBe(score + vp)
            expect(action).toMatchObject({ metadata: { tile: { tileId, vp } } })
        }
    )

    it('R-1.4-H2 a taken tile shows its landscape', () => {
        const start = atFarm()
        const before = start.table.hydrated()
        const tileId = before.regionStacks[start.region][0]
        const landscape = before.requireVault().tileLandscapes[tileId]
        send(start)
        const after = start.table.hydrated()
        expect(after.tileLandscapes[tileId]).toBe(landscape)
        expect(after.requireVault().tileLandscapes).not.toHaveProperty(tileId)
    })

    it('R-4.3.1 an earlier tile than the epoch is legal and scores by its own numeral', () => {
        const start = atFarm((state) => {
            state.epoch = 3
        })
        const [action] = send(start)
        expect(action).toMatchObject({ metadata: { tile: { vp: 3 } } })
    })

    it('S16 in epoch I a prohibited tile takes nothing: no stack is earlier', () => {
        const start = atFarm((state, region) => {
            uncover(state, region, 2)
        })
        const before = start.table.hydrated()
        const stack = [...before.regionStacks[start.region]]
        const score = before.getPlayerState(start.playerId).score

        expect(() => send(start, { fallbackRegion: 'mountain' })).toThrow(
            'There is no earlier tile to take.'
        )
        const [action] = send(start)

        const after = start.table.hydrated()
        const seat = after.getPlayerState(start.playerId)
        expect(seat.regionTiles).toEqual([])
        expect(seat.score).toBe(score)
        expect(after.regionStacks[start.region]).toEqual(stack)
        expect(action).not.toHaveProperty('metadata.tile')
        expect(action.revealsInfo).toBeFalsy()
        expect(after.spaces[start.spaceId].location.kind).toBe('town')
    })

    it('R-4.3-H1 S16 a prohibited tile lets the seat choose an earlier stack, for no vp', () => {
        const start = atFarm((state, region) => {
            state.epoch = 3
            uncover(state, region, 4)
        })
        const fallbackRegion = RegionIds.find((region) => region !== start.region)
        const before = start.table.hydrated()
        const tileId = fallbackRegion && before.regionStacks[fallbackRegion][0]
        const score = before.getPlayerState(start.playerId).score

        expect(() => send(start)).toThrow('Choose a stack to take an earlier tile from.')
        const [action] = send(start, { fallbackRegion })

        const seat = start.table.seat(start.playerId)
        expect(seat.regionTiles).toEqual([tileId])
        expect(seat.score).toBe(score)
        expect(action).toMatchObject({ metadata: { tile: { tileId, vp: 0 } } })
    })

    it('R-4.3-H1 a stack with no earlier tile, or the prohibited stack, is refused', () => {
        const start = atFarm((state, region) => {
            state.epoch = 3
            uncover(state, region, 4)
            const other = RegionIds.find((id) => id !== region)
            if (other) {
                uncover(state, other, 3)
            }
        })
        const other = RegionIds.find((id) => id !== start.region)
        expect(() => send(start, { fallbackRegion: other })).toThrow(
            'That stack has no earlier tile to take.'
        )
        expect(() => send(start, { fallbackRegion: start.region })).toThrow(
            'That stack has no earlier tile to take.'
        )
    })

    it('R-4.3.2 an empty stack is prohibited too', () => {
        const start = atFarm((state, region) => {
            state.epoch = 2
            uncover(state, region, 5)
        })
        const fallbackRegion = RegionIds.find((region) => region !== start.region)
        const [action] = send(start, { fallbackRegion })
        expect(action).toMatchObject({ metadata: { tile: { vp: 0 } } })
    })

    it('a legal tile leaves no stack to choose', () => {
        const start = atFarm()
        expect(() => send(start, { fallbackRegion: 'mountain' })).toThrow(
            'The tile is legal: there is no stack to choose.'
        )
    })

    it('R-4.11-H1 meeting an epoch condition changes nothing until step 4', () => {
        const start = atFarm((state, region) => {
            // Three stacks already show II; this improvement uncovers the fourth.
            for (const other of RegionIds.filter((id) => id !== region).slice(0, 3)) {
                uncover(state, other, 2)
            }
            uncover(state, region, 1)
        })
        expect(triggeredEpoch(start.table.hydrated())).toBeUndefined()
        const [action] = send(start)

        const after = start.table.hydrated()
        expect(triggeredEpoch(after)).toBe(2)
        expect(after.epoch).toBe(1)
        expect(start.table.state.machineState).toBe(MachineState.PlayingCards)
        expect(start.table.asked).toBe(start.table.order[1])
        expect(action).not.toHaveProperty('metadata.epoch')
    })

    it('R-4.3-H1 offers the candidates for no vp, or names the tile and its vp', () => {
        const legal = atFarm()
        expect(improveOffers(legal.table.hydrated(), legal.playerId)[0].tile).toMatchObject({
            kind: 'legal',
            vp: 3
        })
        const prohibited = atFarm((state, region) => {
            state.epoch = 3
            uncover(state, region, 4)
        })
        const offer = improveOffers(prohibited.table.hydrated(), prohibited.playerId)[0]
        expect(offer.tile.kind).toBe('prohibited')
        expect(offer.tile).toMatchObject({
            candidates: expect.arrayContaining([expect.objectContaining({ stack: 'mountain' })])
        })
    })
})
