import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext, assertExists } from '@tabletop/common'
import { ActionType } from '../definition/actions.js'
import { GoodCounts, hasGoods, removeGoods, totalGoods } from '../components/goods.js'
import type { HydratedKoggeGameState } from '../model/gameState.js'

export type DivideSpoils = Type.Static<typeof DivideSpoils>
export const DivideSpoils = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.DivideSpoils),
            playerId: Type.String(),
            pile: GoodCounts
        })
    ])
)

export const DivideSpoilsValidator = Compile(DivideSpoils)

export function isDivideSpoils(action?: GameAction): action is DivideSpoils {
    return action?.type === ActionType.DivideSpoils
}

// Rulebook 3f: the robbed player splits the cargo into two piles of roughly equal size,
// one good apart at most ("die Hälfte (aufgerundet)"), and the robber picks one.
export class HydratedDivideSpoils
    extends HydratableAction<typeof DivideSpoils>
    implements DivideSpoils
{
    declare type: ActionType.DivideSpoils
    declare playerId: string
    declare pile: GoodCounts

    constructor(data: DivideSpoils) {
        super(data, DivideSpoilsValidator)
    }

    apply(state: HydratedKoggeGameState, _context?: MachineContext) {
        const raid = state.raid
        assertExists(raid, 'No raid in progress')
        const cargo = state.getPlayerState(this.playerId).goods
        if (
            raid.victimId !== this.playerId ||
            !HydratedDivideSpoils.isEvenSplit(cargo, this.pile)
        ) {
            throw Error('Invalid DivideSpoils action')
        }
        const otherPile = structuredClone(cargo)
        removeGoods(otherPile, this.pile)
        raid.spoils = [structuredClone(this.pile), otherPile]
    }

    static isEvenSplit(cargo: GoodCounts, pile: GoodCounts): boolean {
        const pileSize = totalGoods(pile)
        const cargoSize = totalGoods(cargo)
        return hasGoods(cargo, pile) && Math.abs(cargoSize - 2 * pileSize) <= 1
    }
}
