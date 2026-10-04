import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext } from '@tabletop/common'
import { ActionType } from '../definition/actions.js'
import { shipDefinition } from '../components/ships.js'
import { canBuildShip, shipsAvailableToBuild } from '../model/building.js'
import type { HydratedStellarHorizonsGameState } from '../model/gameState.js'
import { TurnStep } from '../model/turn.js'

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
        if (
            state.getPlayerState(this.playerId).step !== TurnStep.Build ||
            !canBuildShip(state, this.playerId, this.shipId, this.systemId)
        ) {
            throw Error('Invalid BuildShip action')
        }
        const cost = shipDefinition(this.shipId).cost
        state.getPlayerState(this.playerId).cash -= cost
        const base = state.base(this.playerId, this.systemId)
        if (base) {
            base.spent += cost
        }
        state.ships.push({
            shipId: this.shipId,
            playerId: this.playerId,
            systemId: this.systemId,
            transit: 0,
            damage: 0,
            settlements: 0,
            loadedFromBase: false,
            explored: false
        })
    }

    static canBuildShip(state: HydratedStellarHorizonsGameState, playerId: string): boolean {
        const player = state.getPlayerState(playerId)
        return (
            player.step === TurnStep.Build &&
            shipsAvailableToBuild(state, playerId).some(
                (definition) => definition.cost <= player.cash
            )
        )
    }
}
