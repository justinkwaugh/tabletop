import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext } from '@tabletop/common'
import { ActionType } from '../definition/actions.js'
import {
    CargoPartner,
    CargoTransferResult,
    canTransferAnyCargo,
    cargoPartners,
    cargoTransferLimits,
    sameCargoPartner,
    transferCargo
} from '../model/cargoTransfer.js'
import type { HydratedStellarHorizonsGameState } from '../model/gameState.js'

export type TransferCargo = Type.Static<typeof TransferCargo>
export const TransferCargo = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.TransferCargo),
            playerId: Type.String(),
            shipId: Type.String(),
            partner: CargoPartner,
            settlements: Type.Integer(),
            metadata: Type.Optional(CargoTransferResult)
        })
    ])
)

export const TransferCargoValidator = Compile(TransferCargo)

export function isTransferCargo(action?: GameAction): action is TransferCargo {
    return action?.type === ActionType.TransferCargo
}

export class HydratedTransferCargo
    extends HydratableAction<typeof TransferCargo>
    implements TransferCargo
{
    declare type: ActionType.TransferCargo
    declare playerId: string
    declare shipId: string
    declare partner: CargoPartner
    declare settlements: number
    declare metadata?: CargoTransferResult

    constructor(data: TransferCargo) {
        super(data, TransferCargoValidator)
    }

    apply(state: HydratedStellarHorizonsGameState, _context?: MachineContext) {
        const ship = state.playerShip(this.playerId, this.shipId)
        if (
            !ship ||
            this.settlements === 0 ||
            !cargoPartners(state, ship).some((partner) => sameCargoPartner(partner, this.partner))
        ) {
            throw Error('Invalid TransferCargo action')
        }
        const limits = cargoTransferLimits(state, ship, this.partner)
        if (this.settlements > limits.load || -this.settlements > limits.unload) {
            throw Error('Invalid TransferCargo action')
        }
        this.metadata = transferCargo(state, ship, this.partner, this.settlements)
    }

    static canTransferCargo(state: HydratedStellarHorizonsGameState, playerId: string) {
        return canTransferAnyCargo(state, playerId)
    }
}
