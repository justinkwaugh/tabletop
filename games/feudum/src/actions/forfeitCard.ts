import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext } from '@tabletop/common'
import type { ActionCardKind } from '../data/cards.js'
import { ActionType } from '../definition/actions.js'
import type { HydratedFeudumGameState } from '../model/gameState.js'
import { ActionCardKindSchema } from '../model/stateSchemas.js'
import {
    CardPlayFields,
    playCard,
    reasonNotInHandRefused,
    reasonSecondCardRefused,
    reasonTurnRefused,
    type CardPlayInput
} from './cardPlay.js'

export type ForfeitCard = Type.Static<typeof ForfeitCard>
export const ForfeitCard = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Pick(CardPlayFields, ['secondCard']),
        Type.Object({
            type: Type.Literal(ActionType.ForfeitCard),
            playerId: Type.String(),
            kind: ActionCardKindSchema
        })
    ])
)

export const ForfeitCardValidator = Compile(ForfeitCard)

export function isForfeitCard(action?: GameAction): action is ForfeitCard {
    return action?.type === ActionType.ForfeitCard
}

/** R-3.2, R-3.13-H1 Any card in the hand, its turn's only need; the not-last rule doesn't ask. */
export function reasonForfeitRefused(
    state: HydratedFeudumGameState,
    playerId: string,
    kind: ActionCardKind,
    input: Pick<CardPlayInput, 'secondCard'>
): string | undefined {
    const player = state.getPlayerState(playerId)
    return (
        reasonTurnRefused(state, playerId) ??
        reasonNotInHandRefused(player, kind) ??
        (input.secondCard ? reasonSecondCardRefused(player) : undefined)
    )
}

export class HydratedForfeitCard
    extends HydratableAction<typeof ForfeitCard>
    implements ForfeitCard
{
    declare type: ActionType.ForfeitCard
    declare playerId: string
    declare kind: ActionCardKind
    declare secondCard?: true

    constructor(data: ForfeitCard) {
        super(data, ForfeitCardValidator)
    }

    /** R-3.2 The card is played and does nothing. The input names every fact its line needs. */
    apply(state: HydratedFeudumGameState, _context?: MachineContext) {
        const reason = reasonForfeitRefused(state, this.playerId, this.kind, this)
        if (reason) {
            throw Error(reason)
        }
        playCard(state, this.playerId, this.kind, 'forfeited', this)
    }
}
