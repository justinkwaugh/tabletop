import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext } from '@tabletop/common'
import { Goods, type Good } from '../data/components.js'
import { ActionType } from '../definition/actions.js'
import type { HydratedFeudumGameState } from '../model/gameState.js'
import { GoodSchema } from '../model/stateSchemas.js'
import { takeGoodFromHaversack } from '../model/supply.js'

/** R-1.4.8 */
export const StartingGoodsChosen = 3

export type ChooseStartingGoods = Type.Static<typeof ChooseStartingGoods>
export const ChooseStartingGoods = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.ChooseStartingGoods),
            playerId: Type.String(),
            goods: Type.Array(GoodSchema),
            sulfurToBarrel: Type.Optional(Type.Boolean())
        })
    ])
)

export const ChooseStartingGoodsValidator = Compile(ChooseStartingGoods)

export function isChooseStartingGoods(action?: GameAction): action is ChooseStartingGoods {
    return action?.type === ActionType.ChooseStartingGoods
}

/** R-1.4.8 The goods a seat may pick: those the haversack holds. */
export function startingGoodOffers(state: HydratedFeudumGameState): Good[] {
    return Goods.filter((good) => state.supply.haversack[good] > 0)
}

/** R-1.4.8 Why one good can't be picked; the panel dims it and gives this line. */
export function reasonStartingGoodRefused(
    state: HydratedFeudumGameState,
    good: Good
): string | undefined {
    return startingGoodOffers(state).includes(good) ? undefined : `The haversack holds no ${good}.`
}

/** R-1.4.8 */
export function reasonStartingGoodsRefused(
    state: HydratedFeudumGameState,
    goods: readonly Good[],
    sulfurToBarrel = false
): string | undefined {
    if (goods.length !== StartingGoodsChosen) {
        return `Choose ${StartingGoodsChosen} goods.`
    }
    if (new Set(goods).size !== goods.length) {
        return `Choose ${StartingGoodsChosen} different goods.`
    }
    const refused = goods.flatMap((good) => reasonStartingGoodRefused(state, good) ?? [])
    if (refused.length > 0) {
        return refused[0]
    }
    if (sulfurToBarrel && !goods.includes('sulfur')) {
        return 'Only sulfur goes in the barrel.'
    }
    return undefined
}

export class HydratedChooseStartingGoods
    extends HydratableAction<typeof ChooseStartingGoods>
    implements ChooseStartingGoods
{
    declare type: ActionType.ChooseStartingGoods
    declare playerId: string
    declare goods: Good[]
    declare sulfurToBarrel?: boolean

    constructor(data: ChooseStartingGoods) {
        super(data, ChooseStartingGoodsValidator)
    }

    /** R-1.4.8 The input names every fact its history line needs. */
    apply(state: HydratedFeudumGameState, _context?: MachineContext) {
        const reason = reasonStartingGoodsRefused(state, this.goods, this.sulfurToBarrel)
        if (reason) {
            throw Error(reason)
        }
        const player = state.getPlayerState(this.playerId)
        for (const good of this.goods) {
            takeGoodFromHaversack(state, good)
            if (good === 'sulfur' && this.sulfurToBarrel) {
                player.barrel += 1
            } else {
                player.goods[good] += 1
            }
        }
    }
}
