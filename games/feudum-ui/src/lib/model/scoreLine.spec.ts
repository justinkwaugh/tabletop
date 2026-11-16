import { HydratedFeudumGameState } from '@tabletop/feudum'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { FeudumHost } from '$lib/testing/sessionHarness.js'
import { scoreLineOf, seatOrder, seatPanelOf } from './seatPanel.js'

/** Contract, Seat panel and Supply: the desk's scores, in the seat panels and the zoom row's line. */

let host: FeudumHost

beforeAll(async () => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined)
    host = new FeudumHost(3)
    await host.playStartingGoods()
})

afterAll(() => {
    host.close()
    vi.restoreAllMocks()
})

function withScores(scores: readonly number[]): HydratedFeudumGameState {
    const state = new HydratedFeudumGameState(structuredClone(host.state))
    seatOrder(state).forEach((playerId, index) => {
        state.getPlayerState(playerId).score = scores[index] ?? 0
    })
    return state
}

const nameOf = (playerId: string) => `Name ${playerId}`

describe('R-6 the scores on a desk, with the leader marked', () => {
    it('the line holds every seat in turn order, its name and its score', () => {
        const state = withScores([12, 31, 7])
        expect(scoreLineOf(state, nameOf)).toEqual(
            seatOrder(state).map((playerId, index) => ({
                playerId,
                name: nameOf(playerId),
                score: [12, 31, 7][index],
                leading: index === 1
            }))
        )
    })

    it('a seat panel marks the leader, the same seat as the line', () => {
        const state = withScores([12, 31, 7])
        const leading = seatOrder(state).map(
            (playerId) =>
                seatPanelOf({ state, playerId, viewerId: playerId, nameOf }).ribbon.leading
        )
        expect(leading).toEqual([false, true, false])
    })

    it('seats tied on the top score share the lead', () => {
        const state = withScores([20, 20, 5])
        expect(scoreLineOf(state, nameOf).map(({ leading }) => leading)).toEqual([
            true,
            true,
            false
        ])
    })

    it('with every score the same, no seat leads', () => {
        const state = withScores([0, 0, 0])
        expect(scoreLineOf(state, nameOf).some(({ leading }) => leading)).toBe(false)
    })
})
