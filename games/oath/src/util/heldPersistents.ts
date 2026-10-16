import { HydratedOathGameState } from '../model/gameState.js'
import type { HydratedOathPlayerState } from '../model/playerState.js'
import { powersWithTiming, PowerTiming } from '../data/cardPowers.js'
import { effectFor } from '../powers/registry.js'
import type { PersistentInPlay } from './persistent.js'
import type { ImperialScope } from './rule.js'

/** `siteId`: where a site card stands; `scope`: the Campaign's, which the power is judged in. */
export function persistentsOfCard(
    state: HydratedOathGameState,
    cardId: string,
    ownerIds: readonly string[],
    { siteId, scope }: { siteId?: string; scope?: ImperialScope } = {}
): PersistentInPlay[] {
    const found: PersistentInPlay[] = []
    for (const power of powersWithTiming(cardId, PowerTiming.Persistent)) {
        const hooks = effectFor(power)?.persistent
        if (hooks) found.push({ ctx: { state, cardId, power, ownerIds, siteId, scope }, hooks })
    }
    return found
}

/** R-7.1.1-H1 — a relic is held, never ruled, so its persistent power is its holder's alone. */
export function relicPersistentsHeldBy(
    state: HydratedOathGameState,
    player: HydratedOathPlayerState,
    scope?: ImperialScope
): PersistentInPlay[] {
    return player.relicIds.flatMap((relicId) =>
        persistentsOfCard(state, relicId, [player.playerId], { scope })
    )
}
