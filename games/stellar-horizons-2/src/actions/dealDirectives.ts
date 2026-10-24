import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext } from '@tabletop/common'
import { ActionType } from '../definition/actions.js'
import { DirectiveDeal, dealDirectives, usesDirectives } from '../model/directives.js'
import type { HydratedStellarHorizonsGameState } from '../model/gameState.js'

export type DealDirectives = Type.Static<typeof DealDirectives>
export const DealDirectives = Type.Evaluate(
    Type.Intersect([
        GameAction,
        Type.Object({
            type: Type.Literal(ActionType.DealDirectives),
            metadata: Type.Optional(DirectiveDeal)
        })
    ])
)

export const DealDirectivesValidator = Compile(DealDirectives)

export function isDealDirectives(action?: GameAction): action is DealDirectives {
    return action?.type === ActionType.DealDirectives
}

// Rulebook 5.1: directives are drawn from the shared pool on the Main Line, in initiative order.
export class HydratedDealDirectives
    extends HydratableAction<typeof DealDirectives>
    implements DealDirectives
{
    declare type: ActionType.DealDirectives
    declare metadata?: DirectiveDeal

    constructor(data: DealDirectives) {
        super(data, DealDirectivesValidator)
    }

    apply(state: HydratedStellarHorizonsGameState, _context?: MachineContext) {
        if (!usesDirectives(state)) {
            throw Error('Invalid DealDirectives action')
        }
        this.metadata = dealDirectives(state)
        this.revealsInfo = this.metadata.dealt.length > 0
    }
}
