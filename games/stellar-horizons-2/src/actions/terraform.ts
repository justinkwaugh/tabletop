import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext } from '@tabletop/common'
import { ActionType } from '../definition/actions.js'
import type { HydratedStellarHorizonsGameState } from '../model/gameState.js'
import { TerraformOutcome, terraform, terraformTargets } from '../model/terraforming.js'

export type Terraform = Type.Static<typeof Terraform>
export const Terraform = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.Terraform),
            playerId: Type.String(),
            systemId: Type.String(),
            slot: Type.Number(),
            metadata: Type.Optional(TerraformOutcome)
        })
    ])
)

export const TerraformValidator = Compile(Terraform)

export function isTerraform(action?: GameAction): action is Terraform {
    return action?.type === ActionType.Terraform
}

export class HydratedTerraform extends HydratableAction<typeof Terraform> implements Terraform {
    declare type: ActionType.Terraform
    declare playerId: string
    declare systemId: string
    declare slot: number
    declare metadata?: TerraformOutcome

    constructor(data: Terraform) {
        super(data, TerraformValidator)
    }

    apply(state: HydratedStellarHorizonsGameState, _context?: MachineContext) {
        const isTarget = terraformTargets(state, this.playerId).some(
            (target) => target.systemId === this.systemId && target.slot === this.slot
        )
        if (state.terraformQueue[0] !== this.playerId || !isTarget) {
            throw Error('Invalid Terraform action')
        }
        const outcome = terraform(state, this.playerId, {
            systemId: this.systemId,
            slot: this.slot
        })
        this.metadata = outcome
        if (outcome.drawnTileIds.length > 0) {
            this.revealsInfo = true
        }
    }
}
