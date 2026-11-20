import type { RandomFunction } from '@tabletop/common'
import { Goods, type Good } from '../data/components.js'
import type { HydratedFeudumGameState } from './gameState.js'
import type { GoodCounts } from './stateSchemas.js'

/** R-5.2 The walk follows `Goods`, permanent since recorded draws depend on it. */
export function pickGood(counts: GoodCounts, random: RandomFunction): Good | undefined {
    const total = Goods.reduce((sum, good) => sum + counts[good], 0)
    if (total === 0) {
        return undefined
    }
    let roll = Math.floor(random() * total)
    return Goods.find((good) => {
        roll -= counts[good]
        return roll < 0
    })
}

/** R-5.2, R-1.1-H1 On the protected stream. */
export function drawGoods(state: HydratedFeudumGameState, count: number): Good[] {
    const { random } = state.getProtectedPrng()
    const drawn: Good[] = []
    while (drawn.length < count) {
        const good = pickGood(state.supply.haversack, random)
        if (good === undefined) {
            break
        }
        state.supply.haversack[good] -= 1
        drawn.push(good)
    }
    return drawn
}

/** R-5.2 */
export function drawGood(state: HydratedFeudumGameState): Good | undefined {
    return drawGoods(state, 1).at(0)
}
