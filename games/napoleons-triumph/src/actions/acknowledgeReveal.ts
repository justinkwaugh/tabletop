import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction } from '@tabletop/common'
import { ActionType } from '../definition/actions.js'
import { NapoleonsTriumphAction } from './gameAction.js'
import type { HydratedNapoleonsTriumphGameState } from '../model/gameState.js'
import { legal } from '../model/legality.js'
import { hideRevealedRide } from '../model/turns.js'

export type AcknowledgeReveal = Type.Static<typeof AcknowledgeReveal>
export const AcknowledgeReveal = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.AcknowledgeReveal),
            playerId: Type.String()
        })
    ])
)

export const AcknowledgeRevealValidator = Compile(AcknowledgeReveal)

export function isAcknowledgeReveal(action?: GameAction): action is AcknowledgeReveal {
    return action?.type === ActionType.AcknowledgeReveal
}

/** The player whose turn begins has seen the enemy cavalry still riding when the last turn ended. */
export class HydratedAcknowledgeReveal
    extends NapoleonsTriumphAction<typeof AcknowledgeReveal>
    implements AcknowledgeReveal
{
    declare type: ActionType.AcknowledgeReveal
    declare playerId: string

    constructor(data: AcknowledgeReveal) {
        super(data, AcknowledgeRevealValidator)
    }

    protected perform(state: HydratedNapoleonsTriumphGameState) {
        legal(state.revealedRide !== undefined, 'No cavalry is waiting to be seen')
        legal(state.turnPlayerId === this.playerId, 'It is not that player’s turn')
        hideRevealedRide(state)
        // Taking it back would only turn the cavalry face-up again.
        this.revealsInfo = true
    }
}
