import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext, Visibility } from '@tabletop/common'
import { ActionType } from '../definition/actions.js'
import { chooseDirective, isValidDirectiveChoice } from '../model/directives.js'
import type { HydratedStellarHorizonsGameState } from '../model/gameState.js'
import { FulfilledDirective, HeldDirective } from '../model/pieces.js'

export type ChooseDirectiveMetadata = Type.Static<typeof ChooseDirectiveMetadata>
export const ChooseDirectiveMetadata = Type.Object({
    returned: Type.Array(HeldDirective),
    directives: Type.Optional(Type.Array(FulfilledDirective))
})

export type ChooseDirective = Type.Static<typeof ChooseDirective>
export const ChooseDirective = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.ChooseDirective),
            playerId: Type.String(),
            // Only the chooser sees which directive they kept.
            directiveId: Visibility.protect(Type.String(), { policy: Visibility.Policy.Owner }),
            metadata: Type.Optional(ChooseDirectiveMetadata)
        })
    ])
)

export const ChooseDirectiveValidator = Compile(ChooseDirective)

export function isChooseDirective(action?: GameAction): action is ChooseDirective {
    return action?.type === ActionType.ChooseDirective
}

// Rulebook 5.1: of the directives drawn, the Player keeps one.
export class HydratedChooseDirective
    extends HydratableAction<typeof ChooseDirective>
    implements ChooseDirective
{
    declare type: ActionType.ChooseDirective
    declare playerId: string
    declare directiveId: string
    declare metadata?: ChooseDirectiveMetadata

    constructor(data: ChooseDirective) {
        super(data, ChooseDirectiveValidator)
    }

    apply(state: HydratedStellarHorizonsGameState, _context?: MachineContext) {
        if (!isValidDirectiveChoice(state, this.playerId, this.directiveId)) {
            throw Error('Invalid ChooseDirective action')
        }
        this.metadata = chooseDirective(state, this.playerId, this.directiveId)
    }
}
