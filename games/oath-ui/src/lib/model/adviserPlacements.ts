import { HydratedPlayFacedownAdviser, SearchPlay, type HydratedOathGameState } from '@tabletop/oath'
import { adviserRoom, type AdviserRoom } from './adviserDiscards.js'

// R-5.1.4 — the plays a Search and a facedown adviser print alike; an adviser play reads differently in each.
export const PLAY_LABELS = {
    [SearchPlay.Site]: 'Play to your site',
    [SearchPlay.RevealedVision]: 'Reveal as your Vision',
    [SearchPlay.Conspiracy]: 'Play the Conspiracy',
    [SearchPlay.Discard]: 'Discard it'
} as const satisfies Record<Exclude<SearchPlay, SearchPlay.Adviser>, string>

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
    blockedBecause: string | undefined
    /** R-7.6.4 — a limiter turned faceup may put its holder over the limit. */
    room: AdviserRoom
}

// A refused Site or Adviser placement is shown greyed with its reason; the
// Conspiracy and the Vision are refused for almost every card and are hidden.
export function teaches(play: SearchPlay): boolean {
    return play === SearchPlay.Site || play === SearchPlay.Adviser
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

export function adviserPlacements(
    state: HydratedOathGameState,
    playerId: string,
    cardId: string
): AdviserPlacement[] {
    return ADVISER_PLAYS.map((option) => {
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
        return { ...option, room, blockedBecause: openElsewhere ? undefined : refused }
    }).filter((option) => option.blockedBecause === undefined || teaches(option.play))
}
