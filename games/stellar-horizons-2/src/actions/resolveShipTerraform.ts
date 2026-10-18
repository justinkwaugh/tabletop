import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext } from '@tabletop/common'
import { ActionType } from '../definition/actions.js'
import type { HydratedStellarHorizonsGameState } from '../model/gameState.js'
import { ShipTerraform } from '../model/pieces.js'
import { TerraformOutcome, resolveNextShipTerraform } from '../model/terraforming.js'

export type ResolveShipTerraformMetadata = Type.Static<typeof ResolveShipTerraformMetadata>
export const ResolveShipTerraformMetadata = Type.Object({
    playerId: Type.String(),
    ...ShipTerraform.properties,
    outcome: Type.Optional(TerraformOutcome)
})

export type ResolveShipTerraform = Type.Static<typeof ResolveShipTerraform>
export const ResolveShipTerraform = Type.Evaluate(
    Type.Intersect([
        GameAction,
        Type.Object({
            type: Type.Literal(ActionType.ResolveShipTerraform),
            metadata: Type.Optional(ResolveShipTerraformMetadata)
        })
    ])
)

export const ResolveShipTerraformValidator = Compile(ResolveShipTerraform)

export function isResolveShipTerraform(action?: GameAction): action is ResolveShipTerraform {
    return action?.type === ActionType.ResolveShipTerraform
}

export class HydratedResolveShipTerraform
    extends HydratableAction<typeof ResolveShipTerraform>
    implements ResolveShipTerraform
{
    declare type: ActionType.ResolveShipTerraform
    declare metadata?: ResolveShipTerraformMetadata

    constructor(data: ResolveShipTerraform) {
        super(data, ResolveShipTerraformValidator)
    }

    apply(state: HydratedStellarHorizonsGameState, _context?: MachineContext) {
        this.metadata = resolveNextShipTerraform(state)
        if (this.metadata?.outcome?.drawnTileIds.length) {
            this.revealsInfo = true
        }
    }
}
