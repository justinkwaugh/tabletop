import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext } from '@tabletop/common'
import { DirectiveType } from '../components/directives.js'
import { worldTile } from '../components/worlds.js'
import { ActionType } from '../definition/actions.js'
import { recordDirectiveProgress } from '../model/directives.js'
import { FulfilledDirective } from '../model/pieces.js'
import type { HydratedStellarHorizonsGameState } from '../model/gameState.js'
import { applyTerraformChoice, isValidTerraformChoice } from '../model/terraforming.js'

export type ChooseTerraformWorldMetadata = Type.Static<typeof ChooseTerraformWorldMetadata>
export const ChooseTerraformWorldMetadata = Type.Object({
    systemId: Type.String(),
    replacedTileId: Type.Optional(Type.String()),
    directives: Type.Optional(Type.Array(FulfilledDirective))
})

export type ChooseTerraformWorld = Type.Static<typeof ChooseTerraformWorld>
export const ChooseTerraformWorld = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.ChooseTerraformWorld),
            playerId: Type.String(),
            tileId: Type.Optional(Type.String()),
            removedTileIds: Type.Array(Type.String()),
            metadata: Type.Optional(ChooseTerraformWorldMetadata)
        })
    ])
)

export const ChooseTerraformWorldValidator = Compile(ChooseTerraformWorld)

export function isChooseTerraformWorld(action?: GameAction): action is ChooseTerraformWorld {
    return action?.type === ActionType.ChooseTerraformWorld
}

export class HydratedChooseTerraformWorld
    extends HydratableAction<typeof ChooseTerraformWorld>
    implements ChooseTerraformWorld
{
    declare type: ActionType.ChooseTerraformWorld
    declare playerId: string
    declare tileId?: string
    declare removedTileIds: string[]
    declare metadata?: ChooseTerraformWorldMetadata

    constructor(data: ChooseTerraformWorld) {
        super(data, ChooseTerraformWorldValidator)
    }

    apply(state: HydratedStellarHorizonsGameState, _context?: MachineContext) {
        const choice = state.terraformChoice
        if (
            !choice ||
            choice.playerId !== this.playerId ||
            !isValidTerraformChoice(state, this.tileId, this.removedTileIds)
        ) {
            throw Error('Invalid ChooseTerraformWorld action')
        }
        const replaced = applyTerraformChoice(state, this.tileId, this.removedTileIds)
        // Rulebook 5.1's terraform directives: a world terraformed into a class is one replaced
        // by a world of that class (rulebook, drawing worlds: "terraformed into O or M later").
        const directive =
            this.tileId === undefined
                ? undefined
                : recordDirectiveProgress(state, this.playerId, {
                      kind: DirectiveType.Terraform,
                      worldClass: worldTile(this.tileId).worldClass
                  })
        this.metadata = {
            systemId: choice.systemId,
            replacedTileId: replaced?.tileId,
            ...(directive ? { directives: [directive] } : {})
        }
    }
}
