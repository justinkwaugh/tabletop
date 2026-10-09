import { HydratedPlayFacedownAdviser, SearchPlay, type HydratedOathGameState } from '@tabletop/oath'
import { adviserRoom, type AdviserRoom } from './adviserDiscards.js'

// R-5.1.4 — the plays a Search and a facedown adviser print alike; an adviser play reads differently in each.
export const PLAY_LABELS = {
    [SearchPlay.Site]: 'To your site',
    [SearchPlay.RevealedVision]: 'As your Vision',
    [SearchPlay.Conspiracy]: 'Play it',
    [SearchPlay.Discard]: 'Discard'
} as const satisfies Record<Exclude<SearchPlay, SearchPlay.Adviser>, string>

// R-5.1.4.II — a card kept from a Search, or a Vision or the Conspiracy a power asks about, played facedown.
export const FACEDOWN_ADVISER_LABEL = 'Adviser, facedown'

// R-6.1 — a route into R-5.1.4, played faceup; the action's predicate discounts the slot being vacated.
export const ADVISER_PLAYS: { play: SearchPlay; label: string }[] = [
    { play: SearchPlay.Site, label: PLAY_LABELS[SearchPlay.Site] },
    { play: SearchPlay.Adviser, label: 'Turn faceup' },
    { play: SearchPlay.RevealedVision, label: PLAY_LABELS[SearchPlay.RevealedVision] },
    { play: SearchPlay.Conspiracy, label: PLAY_LABELS[SearchPlay.Conspiracy] },
    { play: SearchPlay.Discard, label: PLAY_LABELS[SearchPlay.Discard] }
]

export type AdviserPlacement = {
    play: SearchPlay
    label: string
    /** R-7.6.4 — a limiter turned faceup may put its holder over the limit. */
    room: AdviserRoom
}

function sitePlayOpen(
    state: HydratedOathGameState,
    playerId: string,
    cardId: string,
    toSiteId: string | undefined,
    discardFirstCardId: string | undefined
): boolean {
    return (
        HydratedPlayFacedownAdviser.reasonCannotPlace(state, playerId, {
            cardId,
            play: SearchPlay.Site,
            toSiteId,
            discardFirstCardId
        }) === undefined
    )
}

// R-5.1.4.I the People's Favor — another site to play to, counting a site a discard there would open.
export function adviserOtherSites(
    state: HydratedOathGameState,
    playerId: string,
    cardId: string
): string[] {
    const here = state.getPlayerState(playerId).siteId
    return state
        .allSiteIds()
        .filter(
            (siteId) =>
                siteId !== here &&
                [undefined, ...state.denizensAt(siteId)].some((first) =>
                    sitePlayOpen(state, playerId, cardId, siteId, first)
                )
        )
}

// R-11.10 the Great Slum, R-5.1.4.I the People's Favor — a denizen discarded before the site play,
// offered wherever the engine accepts it for the site being played to.
export function adviserDiscardFirstOptions(
    state: HydratedOathGameState,
    playerId: string,
    cardId: string,
    toSiteId: string | undefined
): string[] {
    return state
        .allSiteIds()
        .flatMap((siteId) => state.denizensAt(siteId))
        .filter((first) => sitePlayOpen(state, playerId, cardId, toSiteId, first))
}

// Contract rule 2 — a placement the engine refuses is not offered.
export function adviserPlacements(
    state: HydratedOathGameState,
    playerId: string,
    cardId: string
): AdviserPlacement[] {
    return ADVISER_PLAYS.flatMap((option) => {
        const room =
            option.play === SearchPlay.Adviser
                ? adviserRoom(state, playerId, cardId, { faceUp: true, fromAdvisers: true })
                : { needed: 0, discardable: [] }
        // R-7.3.3 — the When Played choices, and any discards, are asked after the placement.
        const refused = HydratedPlayFacedownAdviser.reasonCannotPlace(state, playerId, {
            cardId,
            play: option.play,
            discardedAdviserCardIds: room.discardable.slice(0, room.needed)
        })
        const openElsewhere =
            option.play === SearchPlay.Site &&
            refused !== undefined &&
            (adviserOtherSites(state, playerId, cardId).length > 0 ||
                adviserDiscardFirstOptions(state, playerId, cardId, undefined).length > 0)
        return refused === undefined || openElsewhere ? [{ ...option, room }] : []
    })
}
