import {
    ActionType,
    HydratedSearch,
    SearchSource,
    defaultTolls,
    tollsFor,
    type HydratedOathGameState,
    type ModifierUse,
    type PowerCost,
    type PowerUseKey,
    type Region
} from '@tabletop/oath'
import { fittingModifiers } from './modifierFit.js'
import { samePowerUse } from './powerUse.js'

export type SearchRow = {
    source: SearchSource
    /** The discard pile's region (R-7.4: a modifier may name another pile). */
    region?: Region
    cost: number
    draw: number
    /** Mushrooms draws from the bottom of the pile. */
    fromBottom: boolean
    favorTo: (string | undefined)[]
    variant?: number
    /** R-7.1.2 — a pile another card names (Errand Boy) costs what that card costs, beside the Supply. */
    cardCost?: PowerCost
    /** The cards in use that fit this source: the row is priced and sent with them. */
    modifiers: ModifierUse[]
}

/** A pile a card in use lets the Search draw from, with that card named for it. */
export type PileVariant = {
    use: PowerUseKey
    modifiers: readonly ModifierUse[]
    cost: PowerCost
}

/** R-7.4 — the cards in use a Search of this source is judged and sent with. */
function searchModifiers(
    state: HydratedOathGameState,
    playerId: string,
    source: SearchSource,
    declared: readonly ModifierUse[]
): ModifierUse[] {
    return fittingModifiers(state, playerId, ActionType.Search, declared, { drawFrom: source })
}

/**
 * R-5.1.1, R-7.4 — every source the engine accepts: the world deck and the seat's own pile, each
 * judged without a card that names another pile, then each pile such a card names, sent with it.
 */
export function searchRows(
    state: HydratedOathGameState,
    playerId: string,
    declared: readonly ModifierUse[],
    variants: readonly PileVariant[]
): SearchRow[] {
    const tolls = defaultTolls(state, playerId, { kind: 'search' })
    const payees = tollsFor(state, playerId, { kind: 'search' })
    const favorTo = tolls.map((cardId) => payees.find((t) => t.cardId === cardId)?.payeeId)
    const row = (
        source: SearchSource,
        inUse: readonly ModifierUse[],
        variant?: { index: number; cost: PowerCost }
    ): SearchRow[] => {
        const modifiers = searchModifiers(state, playerId, source, inUse)
        const plan = HydratedSearch.plan(state, playerId, source, modifiers, tolls)
        if (plan.reason) return []
        const region =
            source === SearchSource.Discard
                ? HydratedSearch.drawRegion(state, playerId, modifiers)
                : undefined
        return [
            {
                source,
                ...(region ? { region } : {}),
                cost: plan.cost,
                draw: HydratedSearch.drawCount(state, playerId, modifiers, source),
                fromBottom:
                    source === SearchSource.Discard &&
                    HydratedSearch.drawsFromBottom(state, playerId, modifiers),
                favorTo,
                ...(variant === undefined
                    ? {}
                    : { variant: variant.index, cardCost: variant.cost }),
                modifiers
            }
        ]
    }
    const plain = declared.filter((m) => !variants.some((v) => samePowerUse(m, v.use)))
    return [
        ...row(SearchSource.WorldDeck, plain),
        ...row(SearchSource.Discard, plain),
        ...variants.flatMap((v, index) =>
            row(SearchSource.Discard, v.modifiers, { index, cost: v.cost })
        )
    ]
}
