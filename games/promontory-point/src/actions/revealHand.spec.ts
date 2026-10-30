import { ActionSource, assertExists, type GameAction } from '@tabletop/common'
import { describe, expect, it } from 'vitest'
import { MachineState } from '../definition/states.js'
import type { PromontoryPointGameState } from '../model/gameState.js'
import { PLACEMENTS_PER_TURN } from '../model/turn.js'
import { startGame } from '../testing/startGame.js'
import {
    action,
    actionEngine,
    playerOf,
    atTurnStart,
    edited,
    turnPlayer
} from '../testing/turns.js'
import { RevealHand } from './revealHand.js'

function revealHand(state: PromontoryPointGameState, playerId = turnPlayer(state)) {
    return action(RevealHand, state, { source: ActionSource.System, playerId })
}

function keepingAPiece(state: PromontoryPointGameState): PromontoryPointGameState {
    return edited(state, (draft) => {
        const piece = draft.bag.items.pop()
        assertExists(piece, 'The bag holds a piece to keep')
        draft.bag.remaining -= 1
        playerOf(draft, turnPlayer(draft)).keptPiece = piece
    })
}

describe('RevealHand', () => {
    it('R-2.2 step 1, R-5: turns the hand face up into the turn pieces and opens the turn', () => {
        const { game, state } = startGame()
        const started = atTurnStart(state)
        const playerId = turnPlayer(started)
        const hand = playerOf(started, playerId).hand

        const { processedActions, updatedState } = actionEngine.executeCanonicalAction({
            action: revealHand(started),
            state: started,
            game
        })

        expect(updatedState.turn).toEqual({
            pieces: hand,
            tradesUsed: 0,
            placementsMade: 0,
            placementsLeft: PLACEMENTS_PER_TURN
        })
        expect(playerOf(updatedState, playerId)).toMatchObject({ hand: [], handCount: 0 })
        expect(processedActions).toHaveLength(1)
        expect(processedActions[0]).toMatchObject({
            source: ActionSource.System,
            playerId,
            revealsInfo: true,
            metadata: { pieces: hand }
        })
    })

    it('R-6.3-H2: a kept piece joins the turn pieces and leaves the kept slot', () => {
        const { game, state } = startGame({ config: { fourPieceVariant: true } })
        const started = keepingAPiece(atTurnStart(state))
        const playerId = turnPlayer(started)
        const { hand, keptPiece } = playerOf(started, playerId)
        assertExists(keptPiece, 'The fixture keeps a piece')

        const { processedActions, updatedState } = actionEngine.executeCanonicalAction({
            action: revealHand(started),
            state: started,
            game
        })

        expect(updatedState.turn?.pieces).toEqual([...hand, keptPiece])
        expect(updatedState.turn?.placementsLeft).toBe(PLACEMENTS_PER_TURN)
        expect(playerOf(updatedState, playerId).keptPiece).toBeUndefined()
        expect(processedActions[0]).toMatchObject({ metadata: { pieces: [...hand, keptPiece] } })
    })

    it('R-2.2 step 1: is refused when attributed to a seat whose turn it is not', () => {
        const { game, state } = startGame()
        const started = edited(atTurnStart(state), (draft) => {
            draft.activePlayerIds = draft.turnManager.turnOrder
        })
        const otherPlayerId = started.turnManager.turnOrder[1]

        expect(() =>
            actionEngine.executeCanonicalAction({
                action: revealHand(started, otherPlayerId),
                state: started,
                game
            })
        ).toThrow('RevealHand belongs to the turn player')
    })

    it('R-2.2 step 1: is refused once the turn has moved past its start', () => {
        const { game, state } = startGame()
        const trading = edited(atTurnStart(state), (draft) => {
            draft.machineState = MachineState.TradingBeforePlacing
        })

        expect(() =>
            actionEngine.executeCanonicalAction({
                action: revealHand(trading),
                state: trading,
                game
            })
        ).toThrow('RevealHand belongs to the turn player')
    })

    it('R-X.2: sets revealsInfo, so Undo stops at the reveal', () => {
        const { game, state } = startGame()
        const started = atTurnStart(state)
        const { processedActions } = actionEngine.executeCanonicalAction({
            action: revealHand(started),
            state: started,
            game
        })
        const recorded: GameAction = processedActions[0]

        expect(recorded.revealsInfo).toBe(true)
    })
})
