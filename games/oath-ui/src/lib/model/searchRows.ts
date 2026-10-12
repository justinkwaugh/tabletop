import {
    ActionType,
    HydratedSearch,
    SearchSource,
    defaultTolls,
    tollsFor,
    type HydratedOathGameState,
    type ModifierUse,
    type Region
} from '@tabletop/oath'
import { fittingModifiers } from './modifierFit.js'

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
    /** The cards in use that fit this source: the row is priced and sent with them. */
    modifiers: ModifierUse[]
}

/** R-7.4 — the cards in use a Search of this source is judged and sent with. */
export function searchModifiers(
    state: HydratedOathGameState,
    playerId: string,
    source: SearchSource,
    declared: readonly ModifierUse[]
): ModifierUse[] {
    return fittingModifiers(state, playerId, ActionType.Search, declared, { drawFrom: source })
}

/** R-5.1.1, R-7.4 — every source the engine accepts, judged with each pile a modifier may name. */
export function searchRows(
    state: HydratedOathGameState,
    playerId: string,
    declared: readonly ModifierUse[],
    variants: readonly { modifiers: readonly ModifierUse[] }[]
): SearchRow[] {
    const tolls = defaultTolls(state, playerId, { kind: 'search' })
    const payees = tollsFor(state, playerId, { kind: 'search' })
    const favorTo = tolls.map((cardId) => payees.find((t) => t.cardId === cardId)?.payeeId)
    const row = (
        source: SearchSource,
        inUse: readonly ModifierUse[],
        variant?: number
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
                ...(variant === undefined ? {} : { variant }),
                modifiers
            }
        ]
    }
    const piles =
        variants.length > 0
            ? variants.flatMap((v, index) => row(SearchSource.Discard, v.modifiers, index))
            : row(SearchSource.Discard, declared)
    return [...row(SearchSource.WorldDeck, declared), ...piles]
}
