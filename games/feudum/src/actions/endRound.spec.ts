import { ActionSource, Visibility } from '@tabletop/common'
import { describe, expect, it } from 'vitest'
import { ActionType } from '../definition/actions.js'
import { FeudumApiActions } from '../definition/apiActions.js'
import { FeudumGameState, HydratedFeudumGameState } from '../model/gameState.js'
import { canonicalOf } from '../testing/state.js'
import { tableAtPlayingCards } from '../testing/table.js'
import { HydratedEndRound } from './endRound.js'

const actionProjector = Visibility.createActionProjector(FeudumApiActions)
const stateProjector = Visibility.createProjector(FeudumGameState)

function endRound(state: HydratedFeudumGameState, gameId: string): HydratedEndRound {
    const action = new HydratedEndRound({
        id: 'end',
        gameId,
        source: ActionSource.System,
        type: ActionType.EndRound
    })
    action.apply(state)
    return action
}

describe('EndRound', () => {
    it('R-2.2.5 everyone takes back all action cards at the round’s end', () => {
        const table = tableAtPlayingCards()
        const [first, ...others] = table.order
        table.send(first, { type: ActionType.ForfeitCard, kind: 'move' })
        const state = table.hydrated()
        expect(state.getPlayerState(first).played).not.toEqual([])

        endRound(state, table.game.id)

        for (const playerId of [first, ...others]) {
            const seat = state.getPlayerState(playerId)
            expect(seat.hand).toEqual([])
            expect(seat.handCount).toBe(0)
            expect(seat.played).toEqual([])
        }
    })

    it('R-2.2.5, R-3.3, R-3.15.1, R-3.16.2, R-3.7.5 the round’s limits end with it', () => {
        const table = tableAtPlayingCards()
        const [first] = table.order
        const state = table.hydrated()
        const player = state.getPlayerState(first)
        player.sequentialUsed = true
        player.repeatUsed = true
        player.guildsUsed = ['farmer', 'noble']
        player.successfulMoves = 2

        endRound(state, table.game.id)

        expect(player.sequentialUsed).toBe(false)
        expect(player.repeatUsed).toBe(false)
        expect(player.guildsUsed).toEqual([])
        expect(player.successfulMoves).toBe(0)
    })

    it('R-3.1, R-5.1 on a projected state another seat’s hand stays omitted', () => {
        const table = tableAtPlayingCards()
        const [first, second] = table.order
        const perspective = { kind: 'player', playerId: second } as const
        const state = new HydratedFeudumGameState(
            stateProjector.project(canonicalOf(table.hydrated()), perspective, { config: {} })
        )

        const action = endRound(state, table.game.id)

        expect(state.getPlayerState(first)).not.toHaveProperty('hand')
        expect(state.getPlayerState(first).handCount).toBe(0)
        expect(state.getPlayerState(second).hand).toEqual([])
        expect(
            actionProjector.project(action.dehydrate(), perspective, { config: {} })
        ).toMatchObject({ metadata: action.metadata })
    })
})
