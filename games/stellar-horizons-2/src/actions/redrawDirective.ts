import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext } from '@tabletop/common'
import { ActionType } from '../definition/actions.js'
import { DirectiveRedraw, canRedrawDirective, redrawDirective } from '../model/directives.js'
import type { HydratedStellarHorizonsGameState } from '../model/gameState.js'

export type RedrawDirective = Type.Static<typeof RedrawDirective>
export const RedrawDirective = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.RedrawDirective),
            playerId: Type.String(),
            metadata: Type.Optional(DirectiveRedraw)
        })
    ])
)

export const RedrawDirectiveValidator = Compile(RedrawDirective)

export function isRedrawDirective(action?: GameAction): action is RedrawDirective {
    return action?.type === ActionType.RedrawDirective
}

// Rulebook 5.1: once a turn, 1 IP gives up the directive held for two more to choose from.
export class HydratedRedrawDirective
    extends HydratableAction<typeof RedrawDirective>
    implements RedrawDirective
{
    declare type: ActionType.RedrawDirective
    declare playerId: string
    declare metadata?: DirectiveRedraw

    constructor(data: RedrawDirective) {
        super(data, RedrawDirectiveValidator)
    }

    apply(state: HydratedStellarHorizonsGameState, _context?: MachineContext) {
        if (!canRedrawDirective(state, this.playerId)) {
            throw Error('Invalid RedrawDirective action')
        }
        this.metadata = redrawDirective(state, this.playerId)
        this.revealsInfo = this.metadata.drawn.length > 0
    }
}
