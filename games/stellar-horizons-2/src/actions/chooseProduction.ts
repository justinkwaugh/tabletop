import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext } from '@tabletop/common'
import { ActionType } from '../definition/actions.js'
import { basesAwaitingProduction, isValidProduction } from '../model/economy.js'
import type { HydratedStellarHorizonsGameState } from '../model/gameState.js'
import { Production } from '../model/pieces.js'

export type ChooseProduction = Type.Static<typeof ChooseProduction>
export const ChooseProduction = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.ChooseProduction),
            playerId: Type.String(),
            systemId: Type.String(),
            production: Production
        })
    ])
)

export const ChooseProductionValidator = Compile(ChooseProduction)

export function isChooseProduction(action?: GameAction): action is ChooseProduction {
    return action?.type === ActionType.ChooseProduction
}

// Rulebook 4.4: each base produces cash or one type of tech, chosen by its owner.
export class HydratedChooseProduction
    extends HydratableAction<typeof ChooseProduction>
    implements ChooseProduction
{
    declare type: ActionType.ChooseProduction
    declare playerId: string
    declare systemId: string
    declare production: Production

    constructor(data: ChooseProduction) {
        super(data, ChooseProductionValidator)
    }

    apply(state: HydratedStellarHorizonsGameState, _context?: MachineContext) {
        const base = basesAwaitingProduction(state, this.playerId).find(
            (candidate) => candidate.systemId === this.systemId
        )
        if (!base || !isValidProduction(this.production)) {
            throw Error('Invalid ChooseProduction action')
        }
        base.production = this.production
    }
}
