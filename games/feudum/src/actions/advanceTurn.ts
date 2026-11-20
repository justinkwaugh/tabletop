import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import {
    ActionSource,
    assertExists,
    GameAction,
    HydratableAction,
    MachineContext
} from '@tabletop/common'
import { ActionType } from '../definition/actions.js'
import type { HydratedFeudumGameState } from '../model/gameState.js'
import { cardTurnSeat } from '../model/turns.js'

export type AdvanceTurnMetadata = Type.Static<typeof AdvanceTurnMetadata>
export const AdvanceTurnMetadata = Type.Object({
    outcome: Type.Union([
        /** R-3.3-H1 The same seat plays the card it declared. */
        Type.Literal('second-card'),
        /** R-3.2, R-3.2-H1 The next seat holding a card. */
        Type.Literal('next-seat'),
        /** R-3.2 Nobody holds a card. */
        Type.Literal('last-card')
    ]),
    /** The seat on turn after this; absent on `last-card`. */
    turnPlayerId: Type.Optional(Type.String())
})

export type AdvanceTurn = Type.Static<typeof AdvanceTurn>
export const AdvanceTurn = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['source']),
        Type.Object({
            type: Type.Literal(ActionType.AdvanceTurn),
            source: Type.Literal(ActionSource.System),
            metadata: Type.Optional(AdvanceTurnMetadata)
        })
    ])
)

export const AdvanceTurnValidator = Compile(AdvanceTurn)

export function isAdvanceTurn(action?: GameAction): action is AdvanceTurn {
    return action?.type === ActionType.AdvanceTurn
}

/** R-3.2-H1 Reads the public count, so another seat's hand is never needed. */
export function holdsCards(state: HydratedFeudumGameState, playerId: string): boolean {
    return state.getPlayerState(playerId).handCount > 0
}

export class HydratedAdvanceTurn
    extends HydratableAction<typeof AdvanceTurn>
    implements AdvanceTurn
{
    declare type: ActionType.AdvanceTurn
    declare source: ActionSource.System
    declare metadata?: AdvanceTurnMetadata

    constructor(data: AdvanceTurn) {
        super(data, AdvanceTurnValidator)
    }

    /** R-3.2, R-3.3-H1, R-4.4.4 A declared second card comes before the turn passes. */
    apply(state: HydratedFeudumGameState, _context?: MachineContext) {
        const { turn } = state.flow
        const turnPlayerId = cardTurnSeat(state)
        assertExists(turn, 'R-3.2 A turn is ending')
        assertExists(turnPlayerId, 'R-3.2 A turn is open')
        if (turn.secondCard) {
            this.metadata = { outcome: 'second-card', turnPlayerId }
            return
        }
        const next = HydratedAdvanceTurn.passTurn(state)
        this.metadata = next
            ? { outcome: 'next-seat', turnPlayerId: next }
            : { outcome: 'last-card' }
    }

    /** R-3.2, R-3.2-H1 Clockwise, skipping seats with no cards. Nobody left: no turn. */
    private static passTurn(state: HydratedFeudumGameState): string | undefined {
        const { turnManager, actionCount } = state
        turnManager.endTurn(actionCount)
        if (!turnManager.turnOrder.some((playerId) => holdsCards(state, playerId))) {
            state.flow.turn = undefined
            return undefined
        }
        const playerId = turnManager.startNextTurn(actionCount, (seat) => holdsCards(state, seat))
        state.flow.turn = { secondCard: false, followUps: [] }
        return playerId
    }
}
