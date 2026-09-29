import { HydratedOathGameState } from '../model/gameState.js'
import { receiveFavor } from './favor.js'
import { persistentsInPlay } from './persistent.js'

/** R-10.4 — every burn routes through here so Vow of Renewal can claim it. */
export function burnFavor(state: HydratedOathGameState, count: number): string | undefined {
    if (count <= 0) return undefined
    for (const { ctx, hooks } of persistentsInPlay(state)) {
        const taker = hooks.takesBurnedFavor?.(ctx)
        if (taker) {
            receiveFavor(state, taker, count)
            return taker
        }
    }
    state.favorSupply += count
    return undefined
}
