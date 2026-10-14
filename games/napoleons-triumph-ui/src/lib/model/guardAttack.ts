import {
    isLegal,
    standingGroupKey,
    threatenAttack,
    type HydratedNapoleonsTriumphGameState
} from '@tabletop/napoleons-triumph'
import { firstOfEach } from '$lib/utils/ids.js'
import { inReadingOrder } from '$lib/utils/unitTypeOrder.js'
import { copyOf } from './stateCopy.js'
import type { AttackTarget } from './targets.js'

/** Rule 15: a Guard Attack is announced with the threat by showing one Guard unit that could make it. The Guard units of one corps, or detached at one place, are alike, so one stands for them all, and one the enemy has already seen gives nothing more away. */
export function guardUnitsToAnnounce(
    state: HydratedNapoleonsTriumphGameState,
    playerId: string,
    threat: AttackTarget
): string[] {
    const { locale, approach } = threat.position
    const guards = state
        .unitsOf(playerId)
        .filter((unit) => unit.face?.guard === true && unit.position?.locale === locale)
    const able = inReadingOrder(guards).filter((unit) =>
        isLegal(() => threatenAttack(copyOf(state), playerId, approach, unit.id))
    )
    const seenFirst = able.toSorted(
        (a, b) => Number(b.shown !== undefined) - Number(a.shown !== undefined)
    )
    return firstOfEach(able, standingGroupKey).map((first) => {
        const group = standingGroupKey(first)
        const shown = seenFirst.find((unit) => standingGroupKey(unit) === group) ?? first
        return shown.id
    })
}
