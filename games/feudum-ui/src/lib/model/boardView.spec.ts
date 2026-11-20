// @vitest-environment node
import { describe, expect, it } from 'vitest'
import {
    EpicVoyageTrack,
    HydratedFeudumGameState,
    knightRows,
    MilitaryServiceTrack,
    RegionIds,
    RegionTiles,
    ScoreTrack
} from '@tabletop/feudum'
import { atPlayingCards } from '$lib/testing/turnTable.js'
import { PrintedColours } from '$lib/utils/boardGeometry.js'
import { influencePools, scoreOnTrack, serviceDiscs, stackView, voyageDiscs } from './boardView.js'

async function table() {
    const { host } = await atPlayingCards(['explore'])
    return new HydratedFeudumGameState(structuredClone(host.state))
}

describe('scoreOnTrack (R-1.2.5, R-6)', () => {
    it('R-1.2.5 stands a score on its own space, with no chip, up to the highest', () => {
        expect(scoreOnTrack(0)).toEqual({ space: 0 })
        expect(scoreOnTrack(ScoreTrack.highest)).toEqual({ space: ScoreTrack.highest })
    })

    it('R-6 wraps at 150 and says so with a "+150" chip', () => {
        expect(scoreOnTrack(ScoreTrack.spaces)).toEqual({ space: 0, chip: '+150' })
        expect(scoreOnTrack(163)).toEqual({ space: 13, chip: '+150' })
    })

    it('R-6 wraps as many times as the score asks', () => {
        expect(scoreOnTrack(301)).toEqual({ space: 1, chip: '+300' })
    })

    it('R-6 pins a score under the lowest space to it, the chip giving the score', () => {
        expect(scoreOnTrack(-4)).toEqual({ space: ScoreTrack.lowest, chip: '-4' })
    })
})

describe('the track discs (R-3.7.5, R-4.9-H2)', () => {
    it('R-3.7.5 stands no disc for a seat that has not set out', async () => {
        const state = await table()
        state.voyageTrack = {}
        expect(voyageDiscs(state)).toEqual([])
    })

    it('R-3.7.5 fans the seats sharing a voyage space, the data naming the space', async () => {
        const state = await table()
        const [a, b, c] = state.players.map(({ playerId }) => playerId)
        state.voyageTrack = { [a]: 3, [b]: 3, [c]: 7 }
        const discs = voyageDiscs(state)
        const spaceOf = (space: number) => EpicVoyageTrack.find((row) => row.space === space)?.id
        expect(discs.map(({ spaceId }) => spaceId)).toEqual([spaceOf(3), spaceOf(3), spaceOf(7)])
        expect(discs.map(({ index, count }) => [index, count])).toEqual([
            [0, 2],
            [1, 2],
            [0, 1]
        ])
    })

    it('R-4.9-H2 covers each service space up to the count, one key each', async () => {
        const state = await table()
        const [a, b] = state.players.map(({ playerId }) => playerId)
        state.militaryService = { [a]: 2, [b]: 1 }
        const discs = serviceDiscs(state)
        expect(discs.map(({ playerId, spaceId }) => [playerId, spaceId])).toEqual([
            [a, MilitaryServiceTrack[0].id],
            [a, MilitaryServiceTrack[1].id],
            [b, MilitaryServiceTrack[0].id]
        ])
        expect(new Set(discs.map(({ key }) => key)).size).toBe(discs.length)
        expect(discs[0].count).toBe(2)
    })
})

describe('stackView (R-4.3.1)', () => {
    it("R-4.3.1 gives the count and the top tile's epoch", async () => {
        const state = await table()
        const region = RegionIds[0]
        const late = RegionTiles.filter(({ epoch }) => epoch === 4).map(({ id }) => id)
        state.regionStacks[region] = [...late.slice(0, 1), ...state.regionStacks[region]]
        const view = stackView(state, region)
        expect(view.count).toBe(state.regionStacks[region].length)
        expect(view.topEpoch).toBe(4)
    })

    it('R-4.3.1 has no top epoch on an empty stack', async () => {
        const state = await table()
        state.regionStacks[RegionIds[1]] = []
        expect(stackView(state, RegionIds[1])).toEqual({ region: RegionIds[1], count: 0 })
    })
})

describe('influencePools (R-1.4.2, R-1.4-H1)', () => {
    it('R-1.4-H1 names each seat by its playerId and a dummy row by none, in print order', async () => {
        const state = await table()
        const pools = influencePools(state)
        for (const { playerId, color } of state.players) {
            expect(pools).toContainEqual({
                colour: color,
                playerId,
                count: state.supply.influence[playerId]
            })
        }
        const dummies = knightRows(state).flatMap(({ row }) =>
            'dummyColour' in row.owner ? [row.owner.dummyColour] : []
        )
        expect(dummies.length).toBeGreaterThan(0)
        for (const colour of dummies) {
            expect(pools).toContainEqual({ colour, count: state.supply.dummyInfluence[colour] })
        }
        expect(pools.map(({ colour }) => colour)).toEqual(
            PrintedColours.filter((colour) =>
                [...state.players.map(({ color }) => color), ...dummies].includes(colour)
            )
        )
    })
})
