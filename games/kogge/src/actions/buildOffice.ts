import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext } from '@tabletop/common'
import { ActionType } from '../definition/actions.js'
import type { HydratedKoggeGameState } from '../model/gameState.js'
import { TurnAction } from '../model/turn.js'

export type BuildOffice = Type.Static<typeof BuildOffice>
export const BuildOffice = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.BuildOffice),
            playerId: Type.String(),
            metadata: Type.Optional(
                Type.Object({
                    city: Type.Integer({ minimum: 0 }),
                    markersPaid: Type.Integer({ minimum: 1 })
                })
            )
        })
    ])
)

export const BuildOfficeValidator = Compile(BuildOffice)

export function isBuildOffice(action?: GameAction): action is BuildOffice {
    return action?.type === ActionType.BuildOffice
}

export class HydratedBuildOffice
    extends HydratableAction<typeof BuildOffice>
    implements BuildOffice
{
    declare type: ActionType.BuildOffice
    declare playerId: string
    declare metadata?: { city: number; markersPaid: number }

    constructor(data: BuildOffice) {
        super(data, BuildOfficeValidator)
    }

    apply(state: HydratedKoggeGameState, _context?: MachineContext) {
        if (!state.canBuildOffice(this.playerId)) {
            throw Error('Invalid BuildOffice action')
        }
        const player = state.getPlayerState(this.playerId)
        const cost = state.officeCost(player.location())
        state.pay(player, cost)
        state.city(player.location()).offices.push({ playerId: this.playerId, goods: 0 })
        state.recordTurnAction(this.playerId, TurnAction.BuildOffice)
        this.metadata = { city: player.location(), markersPaid: cost.markers.length }
    }

    static canBuildOffice(state: HydratedKoggeGameState, playerId: string): boolean {
        return state.canBuildOffice(playerId)
    }
}
