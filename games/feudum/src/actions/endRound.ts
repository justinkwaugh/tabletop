import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { ActionSource, GameAction, HydratableAction, MachineContext } from '@tabletop/common'
import { ActionType } from '../definition/actions.js'
import type { HydratedFeudumGameState } from '../model/gameState.js'
import type { HydratedFeudumPlayerState } from '../model/playerState.js'
import { PawnNumberSchema } from '../model/stateSchemas.js'
import { returnGoodToHaversack } from '../model/supply.js'
import { PouchGood } from './finaliseHand.js'

export type EndRoundMetadata = Type.Static<typeof EndRoundMetadata>
export const EndRoundMetadata = Type.Object({
    /** R-2.2.5 Who holds the marker for the next round. */
    startingPlayerId: Type.String(),
    /** R-3.3 */
    pouchesPaid: Type.Array(Type.Object({ playerId: Type.String(), good: PouchGood })),
    /** R-4.10.2 */
    sobered: Type.Array(Type.Object({ playerId: Type.String(), n: PawnNumberSchema }))
})

export type EndRound = Type.Static<typeof EndRound>
export const EndRound = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['source']),
        Type.Object({
            type: Type.Literal(ActionType.EndRound),
            source: Type.Literal(ActionSource.System),
            metadata: Type.Optional(EndRoundMetadata)
        })
    ])
)

export const EndRoundValidator = Compile(EndRound)

export function isEndRound(action?: GameAction): action is EndRound {
    return action?.type === ActionType.EndRound
}

export class HydratedEndRound extends HydratableAction<typeof EndRound> implements EndRound {
    declare type: ActionType.EndRound
    declare source: ActionSource.System
    declare metadata?: EndRoundMetadata

    constructor(data: EndRound) {
        super(data, EndRoundValidator)
    }

    /** R-2.2.5, R-3.3, R-4.10.2 The marker passes, the cards go back, pouches are paid. Public. */
    apply(state: HydratedFeudumGameState, _context?: MachineContext) {
        state.players.forEach(HydratedEndRound.returnCards)
        const pouchesPaid = state.players.flatMap((player) =>
            HydratedEndRound.payPouch(state, player)
        )
        const sobered = state.players.flatMap((player) =>
            HydratedEndRound.soberPawns(state, player)
        )
        state.roundManager.endRound(state.actionCount)
        this.metadata = {
            startingPlayerId: state.passStartingPlayer(),
            pouchesPaid,
            sobered
        }
    }

    /** R-2.2.5, R-3.3, R-3.15.1, R-3.16.2, R-3.7.5 All 11 cards back, and the round's limits end. */
    private static returnCards(player: HydratedFeudumPlayerState): void {
        // Another seat's hand stays omitted from a projected state; its count is public.
        if (player.hand) {
            player.hand = []
        }
        player.handCount = 0
        player.played = []
        player.sequentialUsed = false
        player.repeatUsed = false
        player.guildsUsed = []
        player.successfulMoves = 0
    }

    /** R-3.3 Paid to the haversack whether or not the bonus was used. */
    private static payPouch(
        state: HydratedFeudumGameState,
        player: HydratedFeudumPlayerState
    ): EndRoundMetadata['pouchesPaid'] {
        const { playerId, pouch } = player
        if (!pouch) {
            return []
        }
        returnGoodToHaversack(state, pouch)
        player.pouch = undefined
        return [{ playerId, good: pouch }]
    }

    /** R-4.10.2 A pawn drunk this round gives back its sulfur; one wine fed this round keeps it. */
    private static soberPawns(
        state: HydratedFeudumGameState,
        player: HydratedFeudumPlayerState
    ): EndRoundMetadata['sobered'] {
        return player.pawns.flatMap((pawn) => {
            if (pawn.wine !== 'drunk') {
                return []
            }
            returnGoodToHaversack(state, 'sulfur')
            pawn.wine = undefined
            return [{ playerId: player.playerId, n: pawn.n }]
        })
    }
}
