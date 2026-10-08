import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import {
    GameAction,
    HydratableAction,
    MachineContext,
    Visibility,
    assertExists
} from '@tabletop/common'
import { ActionType } from '../definition/actions.js'
import type { HydratedKoggeGameState } from '../model/gameState.js'
import { TurnAction } from '../model/turn.js'

export type ChangeRoute = Type.Static<typeof ChangeRoute>
export const ChangeRoute = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.ChangeRoute),
            playerId: Type.String(),
            slot: Type.Integer({ minimum: 0, maximum: 1 }),
            marker: Visibility.protect(Type.Integer({ minimum: 0 }), {
                policy: Visibility.Policy.Actor
            }),
            metadata: Type.Optional(
                Type.Object({
                    city: Type.Integer({ minimum: 0 }),
                    replaced: Type.Integer({ minimum: 0 })
                })
            )
        })
    ])
)

export const ChangeRouteValidator = Compile(ChangeRoute)

export function isChangeRoute(action?: GameAction): action is ChangeRoute {
    return action?.type === ActionType.ChangeRoute
}

// Rulebook 3e: the new marker lies face down until a cog first sails along it.
export class HydratedChangeRoute
    extends HydratableAction<typeof ChangeRoute>
    implements ChangeRoute
{
    declare type: ActionType.ChangeRoute
    declare playerId: string
    declare slot: number
    declare marker: number
    declare metadata?: { city: number; replaced: number }

    constructor(data: ChangeRoute) {
        super(data, ChangeRouteValidator)
    }

    apply(state: HydratedKoggeGameState, _context?: MachineContext) {
        if (!state.isValidRouteChange(this.playerId, this.slot, this.marker)) {
            throw Error('Invalid ChangeRoute action')
        }
        const player = state.getPlayerState(this.playerId)
        const city = state.city(player.location())
        const replaced = city.routes[this.slot].value
        assertExists(replaced, 'Only a face-up route marker can be exchanged')
        player.giveMarkers([this.marker])
        player.takeMarkers([replaced])
        city.routes[this.slot] = { hidden: { playerId: this.playerId, value: this.marker } }
        state.recordTurnAction(this.playerId, TurnAction.ChangeRoute)
        this.metadata = { city: city.number, replaced }
    }

    static canChangeRoute(state: HydratedKoggeGameState, playerId: string): boolean {
        return state.canChangeRoute(playerId)
    }
}
