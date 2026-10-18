import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext } from '@tabletop/common'
import { ActionType } from '../definition/actions.js'
import { buildCost, canBuildAnyShip, canBuildShip } from '../model/building.js'
import type { HydratedStellarHorizonsGameState } from '../model/gameState.js'

export type BuildShip = Type.Static<typeof BuildShip>
export const BuildShip = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.BuildShip),
            playerId: Type.String(),
            shipId: Type.String(),
            systemId: Type.String()
        })
    ])
)

export const BuildShipValidator = Compile(BuildShip)

export function isBuildShip(action?: GameAction): action is BuildShip {
    return action?.type === ActionType.BuildShip
}

export class HydratedBuildShip extends HydratableAction<typeof BuildShip> implements BuildShip {
    declare type: ActionType.BuildShip
    declare playerId: string
    declare shipId: string
    declare systemId: string

    constructor(data: BuildShip) {
        super(data, BuildShipValidator)
    }

    apply(state: HydratedStellarHorizonsGameState, _context?: MachineContext) {
        if (!canBuildShip(state, this.playerId, this.shipId, this.systemId)) {
            throw Error('Invalid BuildShip action')
        }
        const cost = buildCost(state, this.shipId, this.systemId)
        state.getPlayerState(this.playerId).cash -= cost
        const base = state.base(this.playerId, this.systemId)
        if (base) {
            base.spent += cost
        }
        state.ships[this.shipId] = {
            shipId: this.shipId,
            playerId: this.playerId,
            systemId: this.systemId,
            transit: 0,
            damage: 0,
            settlements: 0,
            loadedFromBase: false,
            explored: false
        }
    }

    static canBuildShip(state: HydratedStellarHorizonsGameState, playerId: string): boolean {
        return canBuildAnyShip(state, playerId)
    }
}
