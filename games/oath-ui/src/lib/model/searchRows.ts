import {
    HydratedSearch,
    SearchSource,
    defaultTolls,
    tollsFor,
    type HydratedOathGameState,
    type ModifierUse,
    type Region
} from '@tabletop/oath'

export type SearchRow = {
    source: SearchSource
    /** The discard pile's region (R-7.4: a modifier may name another pile). */
    region?: Region
    cost: number
    draw: number
    favorTo: (string | undefined)[]
    variant?: number
}

/** R-5.1.1, R-7.4 — every source the engine accepts, judged with each pile a modifier may name. */
export function searchRows(
    state: HydratedOathGameState,
    playerId: string,
    declared: ModifierUse[],
    variants: readonly { modifiers: ModifierUse[] }[]
): SearchRow[] {
    const tolls = defaultTolls(state, playerId, { kind: 'search' })
    const payees = tollsFor(state, playerId, { kind: 'search' })
    const favorTo = tolls.map((cardId) => payees.find((t) => t.cardId === cardId)?.payeeId)
    const row = (source: SearchSource, modifiers: ModifierUse[], variant?: number) => {
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
                favorTo,
                ...(variant === undefined ? {} : { variant })
            }
        ]
    }
    const piles =
        variants.length > 0
            ? variants.flatMap((v, index) => row(SearchSource.Discard, v.modifiers, index))
            : row(SearchSource.Discard, declared)
    return [...row(SearchSource.WorldDeck, declared), ...piles]
}
