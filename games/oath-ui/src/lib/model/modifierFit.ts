import {
    actsAsAtSite,
    disguisedAs,
    resolveModifiers,
    type ActionType,
    type HydratedOathGameState,
    type ModifierUse
} from '@tabletop/oath'

/** What one row of an action's menu tells a modifier's condition: its card, site, option or pile. */
export type RowParticulars = NonNullable<Parameters<typeof resolveModifiers>[4]>

/**
 * R-7.4 — of the cards in use, the ones the engine accepts on one row of an action's menu, in the
 * order they were declared: a card in use applies to the rows it fits, and each other row is
 * judged and sent without it, so no legal row is hidden. The card declared last is judged first,
 * so a card just put in use wins over one it rules out (Master of Disguise's own advisers).
 * `particulars` may read the cards judged with it (Master of Disguise names whose advisers trade).
 * A card that sets what the others are judged by goes before them all: Master of Disguise's
 * player, whose advisers it lends, then Small Friends' site, whose cards it reaches.
 */
export function fittingModifiers(
    state: HydratedOathGameState,
    playerId: string,
    action: ActionType,
    declared: readonly ModifierUse[],
    particulars: RowParticulars | ((uses: readonly ModifierUse[]) => RowParticulars)
): ModifierUse[] {
    const disguises = declared.filter((use) => disguisedAs(action, [use]) !== undefined)
    const sites = declared.filter(
        (use) => actsAsAtSite(state, playerId, action, [...disguises, use]) !== undefined
    )
    const first = [...disguises, ...sites]
    const order = [...first, ...[...declared].reverse().filter((use) => !first.includes(use))]
    let kept: ModifierUse[] = []
    for (const use of order) {
        const judged = declared.filter((m) => m === use || kept.includes(m))
        const told = typeof particulars === 'function' ? particulars(judged) : particulars
        if (resolveModifiers(state, playerId, action, judged, told).reason === undefined) {
            kept = judged
        }
    }
    return kept
}
