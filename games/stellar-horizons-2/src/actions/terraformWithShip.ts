import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext } from '@tabletop/common'
import { ActionType } from '../definition/actions.js'
import type { HydratedStellarHorizonsGameState } from '../model/gameState.js'
import { queueShipTerraform, shipTerraformSlots } from '../model/terraforming.js'

export type TerraformWithShip = Type.Static<typeof TerraformWithShip>
export const TerraformWithShip = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.TerraformWithShip),
            playerId: Type.String(),
            shipId: Type.String(),
            slot: Type.Number()
        })
    ])
)

export const TerraformWithShipValidator = Compile(TerraformWithShip)

export function isTerraformWithShip(action?: GameAction): action is TerraformWithShip {
    return action?.type === ActionType.TerraformWithShip
}

export class HydratedTerraformWithShip
    extends HydratableAction<typeof TerraformWithShip>
    implements TerraformWithShip
{
    declare type: ActionType.TerraformWithShip
    declare playerId: string
    declare shipId: string
    declare slot: number

    constructor(data: TerraformWithShip) {
        super(data, TerraformWithShipValidator)
    }

    apply(state: HydratedStellarHorizonsGameState, _context?: MachineContext) {
        const ship = state.playerShip(this.playerId, this.shipId)
        if (!ship || !shipTerraformSlots(state, ship).includes(this.slot)) {
            throw Error('Invalid TerraformWithShip action')
        }
        queueShipTerraform(state, ship, this.slot)
    }
}
