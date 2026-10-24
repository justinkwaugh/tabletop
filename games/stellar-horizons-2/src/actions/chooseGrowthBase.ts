import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext } from '@tabletop/common'
import { ActionType } from '../definition/actions.js'
import { ChosenGrowth, growAtChosenBase, growthChoiceBases } from '../model/economy.js'
import type { HydratedStellarHorizonsGameState } from '../model/gameState.js'

// Prolific Breeders' settlement, at the base the Player chooses after growth (rulebook 4.6).
export type ChooseGrowthBase = Type.Static<typeof ChooseGrowthBase>
export const ChooseGrowthBase = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.ChooseGrowthBase),
            playerId: Type.String(),
            systemId: Type.String(),
            metadata: Type.Optional(ChosenGrowth)
        })
    ])
)

export const ChooseGrowthBaseValidator = Compile(ChooseGrowthBase)

export function isChooseGrowthBase(action?: GameAction): action is ChooseGrowthBase {
    return action?.type === ActionType.ChooseGrowthBase
}

export class HydratedChooseGrowthBase
    extends HydratableAction<typeof ChooseGrowthBase>
    implements ChooseGrowthBase
{
    declare type: ActionType.ChooseGrowthBase
    declare playerId: string
    declare systemId: string
    declare metadata?: ChosenGrowth

    constructor(data: ChooseGrowthBase) {
        super(data, ChooseGrowthBaseValidator)
    }

    apply(state: HydratedStellarHorizonsGameState, _context?: MachineContext) {
        if (
            state.growthChoosers.at(0) !== this.playerId ||
            !growthChoiceBases(state, this.playerId).includes(this.systemId)
        ) {
            throw Error('Invalid ChooseGrowthBase action')
        }
        state.growthChoosers = state.growthChoosers.slice(1)
        this.metadata = growAtChosenBase(state, this.playerId, this.systemId)
    }
}
