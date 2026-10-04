import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext } from '@tabletop/common'
import { ActionType } from '../definition/actions.js'
import { RepairMethod, canRepair, repairCost } from '../model/building.js'
import type { HydratedStellarHorizonsGameState } from '../model/gameState.js'
import { TurnStep } from '../model/turn.js'

export type RepairShipMetadata = Type.Static<typeof RepairShipMetadata>
export const RepairShipMetadata = Type.Object({
    cost: Type.Number(),
    repaired: Type.Number()
})

export type RepairShip = Type.Static<typeof RepairShip>
export const RepairShip = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.RepairShip),
            playerId: Type.String(),
            shipId: Type.String(),
            method: Type.Enum(RepairMethod),
            points: Type.Number(),
            metadata: Type.Optional(RepairShipMetadata)
        })
    ])
)

export const RepairShipValidator = Compile(RepairShip)

export function isRepairShip(action?: GameAction): action is RepairShip {
    return action?.type === ActionType.RepairShip
}

export class HydratedRepairShip extends HydratableAction<typeof RepairShip> implements RepairShip {
    declare type: ActionType.RepairShip
    declare playerId: string
    declare shipId: string
    declare method: RepairMethod
    declare points: number
    declare metadata?: RepairShipMetadata

    constructor(data: RepairShip) {
        super(data, RepairShipValidator)
    }

    apply(state: HydratedStellarHorizonsGameState, _context?: MachineContext) {
        const player = state.getPlayerState(this.playerId)
        if (
            player.step !== TurnStep.Build ||
            !canRepair(state, this.playerId, this.shipId, this.method, this.points)
        ) {
            throw Error('Invalid RepairShip action')
        }
        const ship = state.ship(this.shipId)
        const cost = repairCost(this.shipId, this.method, this.points)
        const repaired =
            this.method === RepairMethod.RemoteFull
                ? ship.damage
                : this.method === RepairMethod.RemotePoint
                  ? 1
                  : this.points
        player.cash -= cost
        ship.damage -= repaired
        if (this.method === RepairMethod.Dock) {
            const base = state.base(this.playerId, ship.systemId)
            if (base) {
                base.spent += repaired
            }
        } else {
            player.remoteRepairUsed = true
        }
        this.metadata = { cost, repaired }
    }

    static canRepairShip(state: HydratedStellarHorizonsGameState, playerId: string): boolean {
        if (state.getPlayerState(playerId).step !== TurnStep.Build) {
            return false
        }
        return state
            .shipsOf(playerId)
            .some((ship) =>
                Object.values(RepairMethod).some((method) =>
                    canRepair(state, playerId, ship.shipId, method, 1)
                )
            )
    }
}
