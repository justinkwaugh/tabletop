import { GameAction, HydratableAction, MachineContext, assert } from '@tabletop/common'
import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { ActionType } from '../definition/actions.js'
import type { HydratedRideTheRailsGameState } from '../model/gameState.js'
import { isRidingPlayer } from '../rules/riding.js'
import { journeyExists } from '../rules/routes.js'

export type PassJourney = Type.Static<typeof PassJourney>
export const PassJourney = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.PassJourney),
            playerId: Type.String()
        })
    ])
)

export const PassJourneyValidator = Compile(PassJourney)

export function isPassJourney(action?: GameAction): action is PassJourney {
    return action?.type === ActionType.PassJourney
}

export class HydratedPassJourney
    extends HydratableAction<typeof PassJourney>
    implements PassJourney
{
    declare type: ActionType.PassJourney
    declare playerId: string

    constructor(data: PassJourney) {
        super(data, PassJourneyValidator)
    }

    // R-3.3.1: the pass pays nothing and is open only when no journey exists.
    apply(state: HydratedRideTheRailsGameState, _context?: MachineContext) {
        assert(isRidingPlayer(state, this.playerId), 'It is not your journey')
        assert(!journeyExists(state), 'A journey exists, so you must ride')
    }

    static canPass(state: HydratedRideTheRailsGameState, playerId: string): boolean {
        return isRidingPlayer(state, playerId) && !journeyExists(state)
    }
}
