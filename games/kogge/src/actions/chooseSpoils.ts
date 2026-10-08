import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext, assertExists } from '@tabletop/common'
import { ActionType } from '../definition/actions.js'
import { GoodCounts, addGoods, removeGoods } from '../components/goods.js'
import type { HydratedKoggeGameState } from '../model/gameState.js'

export type ChooseSpoils = Type.Static<typeof ChooseSpoils>
export const ChooseSpoils = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.ChooseSpoils),
            playerId: Type.String(),
            pile: Type.Integer({ minimum: 0, maximum: 1 }),
            metadata: Type.Optional(
                Type.Object({ victimId: Type.String(), taken: GoodCounts, left: GoodCounts })
            )
        })
    ])
)

export const ChooseSpoilsValidator = Compile(ChooseSpoils)

export function isChooseSpoils(action?: GameAction): action is ChooseSpoils {
    return action?.type === ActionType.ChooseSpoils
}

export class HydratedChooseSpoils
    extends HydratableAction<typeof ChooseSpoils>
    implements ChooseSpoils
{
    declare type: ActionType.ChooseSpoils
    declare playerId: string
    declare pile: number
    declare metadata?: { victimId: string; taken: GoodCounts; left: GoodCounts }

    constructor(data: ChooseSpoils) {
        super(data, ChooseSpoilsValidator)
    }

    apply(state: HydratedKoggeGameState, _context?: MachineContext) {
        const raid = state.raid
        assertExists(raid, 'No raid in progress')
        const chosen = raid.spoils?.[this.pile]
        if (
            raid.raiderId !== this.playerId ||
            chosen === undefined ||
            raid.victimId === undefined
        ) {
            throw Error('Invalid ChooseSpoils action')
        }
        const left = raid.spoils?.[1 - this.pile]
        assertExists(left, 'A divided cargo has two piles')
        removeGoods(state.getPlayerState(raid.victimId).goods, chosen)
        addGoods(state.getPlayerState(this.playerId).goods, chosen)
        this.metadata = { victimId: raid.victimId, taken: chosen, left }
    }
}
