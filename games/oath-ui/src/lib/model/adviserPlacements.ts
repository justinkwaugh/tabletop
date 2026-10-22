import {
    ActionType,
    HydratedOathGameState,
    HydratedPlayFacedownAdviser,
    HydratedSearch,
    PowerChoiceKind,
    SearchPlay,
    discardRegionFor,
    discardTargetOf,
    isFreeGain,
    offeredChoices,
    playShowsCard,
    runAfter,
    sitePlayGain,
    usableModifiers,
    type ActiveModifier,
    type CardPower,
    type LegalChoice,
    type ModifierUse,
    type Region,
    type SitePlayGain
} from '@tabletop/oath'
import { adviserRoom, type AdviserRoom } from './adviserDiscards.js'
import {
    FIRST_BRANCH,
    emptyPicks,
    isOr,
    powerChoicesFrom,
    type PowerChoicePicks
} from './powerChoices.js'
import { powerUseKey } from './powerUse.js'

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

/**
 * R-6.1 "(Restrictions and modifiers apply.)", R-7.4 — the Search cards a facedown adviser's play
 * may declare, each in the step it changes. A card is offered only where the engine accepts it on
 * this play, so a game created before the facedown play took modifiers offers none.
 */
export type FacedownPlayCards = {
    /** A card that adds to the play once it is made (Wild Cry): a row above the confirm. */
    rows: CardPower[]
    /** A place a discarded adviser may go besides the discard pile (the Cracked Horn). */
    places: CardPower[]
    /** A card that names the pile, and the side, a discarded adviser goes to (Bracken). */
    pile?: CardPower
    /** A card that opens a site to play to, or a card to discard first there (New Growth, Crop Rotation). */
    placing: ModifierUse[]
}

export const NO_PLAY_CARDS: FacedownPlayCards = { rows: [], places: [], placing: [] }

export type AdviserPlacement = {
    play: SearchPlay
    label: string
    /** R-7.6.4 — a limiter turned faceup may put its holder over the limit. */
    room: AdviserRoom
    cards: FacedownPlayCards
    /** R-5.1.4.I, R-11.2 — "To your site" only: what the play gains there, as the engine plans it. */
    gain?: SitePlayGain
}

/** The card's own part of the play, without the mandatory modifiers the engine adds by itself. */
function declaredAlone(
    state: HydratedOathGameState,
    playerId: string,
    play: SearchPlay,
    use: ModifierUse
): ActiveModifier[] | undefined {
    const { reason, active } = HydratedPlayFacedownAdviser.playModifiers(state, playerId, play, [
        use
    ])
    return reason === undefined ? active.filter((m) => !m.mandatory) : undefined
}

/** R-7.4 — whether the card's own hook, run after the play on a copy of the table, does anything. */
function addsToThePlay(
    state: HydratedOathGameState,
    playerId: string,
    cardId: string,
    play: SearchPlay,
    active: readonly ActiveModifier[]
): boolean {
    const rehearsal = new HydratedOathGameState(state.dehydrate())
    const playedCardId = playShowsCard(play, true) ? cardId : undefined
    return runAfter(rehearsal, playerId, active, { playedCardId, playedTo: play }).notes.length > 0
}

/**
 * A discard sent to a pile: the pile and the side picked so far. R-10.5 — with nothing picked,
 * a discard goes on top of the next region's pile.
 */
export type PilePlace = { region?: Region; bottom?: boolean }

/** R-10.5 — the pile a discard goes to without a card: the next region's, on top. */
export function usualDiscardRegion(state: HydratedOathGameState, playerId: string): Region {
    return discardRegionFor(HydratedSearch.drawRegion(state, playerId, []))
}

/** A pile card's picks for a pile and a side: its Region spec, then its "or" (Bracken's top or bottom). */
function pilePicks(
    legal: readonly LegalChoice[],
    region: Region,
    bottom: boolean
): PowerChoicePicks {
    const option: Record<number, number> = {}
    legal.forEach((choice, index) => {
        if (isOr(choice)) option[index] = bottom ? 0 : FIRST_BRANCH
        const at = choice.options.findIndex(
            (o) => o.kind === PowerChoiceKind.Region && o.region === region
        )
        if (at >= 0) option[index] = at
    })
    return { ...emptyPicks(), option }
}

/** The pile card declared for a pile and a side, as the play sends it. */
export function pileCardUse(
    state: HydratedOathGameState,
    playerId: string,
    card: CardPower,
    region: Region,
    bottom: boolean
): ModifierUse {
    const legal = offeredChoices(state, playerId, card)
    return {
        ...powerUseKey(card),
        choices: powerChoicesFrom(legal, pilePicks(legal, region, bottom))
    }
}

/**
 * R-6.1, Bracken — the card a discarded adviser's pile and side are sent with: none while the
 * pick is not whole, or is where the discard goes anyway (the next region's pile, on top).
 */
export function pilePlaceUses(
    state: HydratedOathGameState,
    playerId: string,
    card: CardPower | undefined,
    place: PilePlace
): ModifierUse[] {
    const { region, bottom } = place
    if (!card || region === undefined || bottom === undefined) return []
    if (region === usualDiscardRegion(state, playerId) && !bottom) return []
    return [pileCardUse(state, playerId, card, region, bottom)]
}

/** The piles a pile card offers, in its options' order. */
export function pileCardRegions(
    state: HydratedOathGameState,
    playerId: string,
    card: CardPower
): Region[] {
    return offeredChoices(state, playerId, card).flatMap((choice) =>
        choice.options.flatMap((o) => (o.kind === PowerChoiceKind.Region ? [o.region] : []))
    )
}

/** R-7.4 — a card whose picks name the pile a discard goes to (Bracken), as the engine reads it. */
function namesDiscardPile(
    state: HydratedOathGameState,
    playerId: string,
    play: SearchPlay,
    power: CardPower
): boolean {
    const [region] = pileCardRegions(state, playerId, power)
    if (region === undefined) return false
    const active = declaredAlone(
        state,
        playerId,
        play,
        pileCardUse(state, playerId, power, region, false)
    )
    return active !== undefined && discardTargetOf(state, playerId, active)?.region === region
}

/**
 * R-6.1, R-7.4 — each usable Search card the engine accepts alone on this play, by the step it
 * changes, as the engine's own hooks say: where a discard goes (the Cracked Horn, under Discard
 * only), what the play adds once made (Wild Cry, only where it adds something), or where a site
 * play may go (New Growth, Crop Rotation). Of the cards that ask picks of their own, one that
 * names the pile a discard goes to (Bracken) is offered under Discard; the others are not.
 */
export function facedownPlayCards(
    state: HydratedOathGameState,
    playerId: string,
    cardId: string,
    play: SearchPlay
): FacedownPlayCards {
    const cards: FacedownPlayCards = { rows: [], places: [], placing: [] }
    for (const power of usableModifiers(state, playerId, ActionType.Search)) {
        if (offeredChoices(state, playerId, power).length > 0) {
            if (
                play === SearchPlay.Discard &&
                !cards.pile &&
                namesDiscardPile(state, playerId, play, power)
            ) {
                cards.pile = power
            }
            continue
        }
        const use = powerUseKey(power)
        const active = declaredAlone(state, playerId, play, use)
        if (!active) continue
        const target = discardTargetOf(state, playerId, active)
        if (target) {
            if (play === SearchPlay.Discard && target.worldDeck) cards.places.push(power)
        } else if (addsToThePlay(state, playerId, cardId, play, active)) {
            cards.rows.push(power)
        } else if (play === SearchPlay.Site) {
            cards.placing.push(use)
        }
    }
    return cards
}

/** The rows in use when the play is chosen: its free gains (Wild Cry). */
export function rowsAtStart(cards: FacedownPlayCards): ModifierUse[] {
    return cards.rows.filter(isFreeGain).map(powerUseKey)
}

/** Every choice of the cards, the fewest first, each in the order given. */
function fewestFirst(cards: readonly ModifierUse[]): ModifierUse[][] {
    const all = cards.reduce<ModifierUse[][]>(
        (subsets, card) => [...subsets, ...subsets.map((subset) => [...subset, card])],
        [[]]
    )
    return all.sort((a, b) => a.length - b.length)
}

export type SitePick = { toSiteId?: string; discardFirstCardId?: string }

/**
 * R-6.1, R-7.4 — the placing cards a site play needs to go where it is sent: the fewest the
 * engine accepts beside the cards already carried (the rows in use), or undefined when none opens
 * it. So a site only New Growth opens uses New Growth, and a card only Crop Rotation lets go first
 * uses Crop Rotation. The send carries the same list.
 */
export function sitePlayUses(
    state: HydratedOathGameState,
    playerId: string,
    cardId: string,
    pick: SitePick,
    placing: readonly ModifierUse[],
    carried: readonly ModifierUse[]
): ModifierUse[] | undefined {
    return fewestFirst(placing).find(
        (uses) =>
            HydratedPlayFacedownAdviser.reasonCannotPlace(state, playerId, {
                cardId,
                play: SearchPlay.Site,
                ...pick,
                modifiers: [...carried, ...uses]
            }) === undefined
    )
}

// R-5.1.4.I the People's Favor, New Growth — another site to play to, counting a site a discard
// there would open.
export function adviserOtherSites(
    state: HydratedOathGameState,
    playerId: string,
    cardId: string,
    placing: readonly ModifierUse[] = [],
    carried: readonly ModifierUse[] = []
): string[] {
    const here = state.getPlayerState(playerId).siteId
    const firsts = [undefined, ...state.allSiteIds().flatMap((siteId) => state.denizensAt(siteId))]
    return state
        .allSiteIds()
        .filter(
            (toSiteId) =>
                toSiteId !== here &&
                firsts.some(
                    (discardFirstCardId) =>
                        sitePlayUses(
                            state,
                            playerId,
                            cardId,
                            { toSiteId, discardFirstCardId },
                            placing,
                            carried
                        ) !== undefined
                )
        )
}

// R-11.10 the Great Slum, R-5.1.4.I the People's Favor, Crop Rotation — a denizen discarded
// before the site play, offered wherever the engine accepts it for the site being played to.
export function adviserDiscardFirstOptions(
    state: HydratedOathGameState,
    playerId: string,
    cardId: string,
    toSiteId: string | undefined,
    placing: readonly ModifierUse[] = [],
    carried: readonly ModifierUse[] = []
): string[] {
    return state
        .allSiteIds()
        .flatMap((siteId) => state.denizensAt(siteId))
        .filter(
            (discardFirstCardId) =>
                sitePlayUses(
                    state,
                    playerId,
                    cardId,
                    { toSiteId, discardFirstCardId },
                    placing,
                    carried
                ) !== undefined
        )
}

// Contract rule 2 — a placement the engine refuses is not offered; each is judged with the cards
// its send carries at the start (its free gains).
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
        const cards = facedownPlayCards(state, playerId, cardId, option.play)
        const carried = rowsAtStart(cards)
        // R-7.3.3 — the When Played choices, and any discards, are asked after the placement.
        const refused = HydratedPlayFacedownAdviser.reasonCannotPlace(state, playerId, {
            cardId,
            play: option.play,
            discardedAdviserCardIds: room.discardable.slice(0, room.needed),
            modifiers: carried
        })
        const openElsewhere =
            option.play === SearchPlay.Site &&
            refused !== undefined &&
            (adviserOtherSites(state, playerId, cardId, cards.placing, carried).length > 0 ||
                adviserDiscardFirstOptions(
                    state,
                    playerId,
                    cardId,
                    undefined,
                    cards.placing,
                    carried
                ).length > 0)
        if (refused !== undefined && !openElsewhere) return []
        const gain =
            option.play === SearchPlay.Site
                ? sitePlayGain(
                      HydratedPlayFacedownAdviser.playMapChanges(state, playerId, {
                          cardId,
                          play: option.play,
                          modifiers: carried
                      })
                  )
                : undefined
        return [{ ...option, room, cards, ...(gain ? { gain } : {}) }]
    })
}
