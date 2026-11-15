import { HydratedOathGameState } from '../model/gameState.js'
import { CardKind, Region } from '../model/oathEnums.js'
import { PRINTED_DENIZEN_IDS, isVision, kindOf } from '../data/cardRegistry.js'
import { ALL_SITE_IDS } from '../data/sites.js'
import { ALL_RELIC_IDS, GRAND_SCEPTER_ID, RELIC_DECK_IDS } from '../data/relics.js'
import { ALL_VISION_IDS } from '../data/visions.js'
import { EDIFICE_DEFINITIONS } from '../data/edifices.js'
import { TOP_PILE_DENIZENS, SECOND_PILE_DENIZENS } from '../data/worldDeck.js'
import { warbandEntries } from '../util/warbands.js'
import { denizensInCirculation } from '../util/chronicleCards.js'

/**
 * A game as it opens, checked whole (host-side): the 198 denizens each in at most one of the world
 * deck, the piles, the hands, the advisers, the sites and the Dispossessed, as many in play as the
 * record says (the rest the Archive); the five Visions; the 23 sites in the slots and the site deck;
 * the 21 relics with the Chancellor, in the Reliquary, at the sites and in the relic deck; the six
 * edifices at the sites or in the Archive. Returns every breach found.
 */
export function openingCensus(state: HydratedOathGameState): string[] {
    const vault = state.requireVault()
    const breaches: string[] = []
    const once = (what: string, placed: readonly string[], universe: readonly string[]) => {
        const seen = new Set<string>()
        for (const cardId of placed) {
            if (seen.has(cardId)) breaches.push(`${what}: ${cardId} is in two places`)
            if (!universe.includes(cardId)) breaches.push(`${what}: ${cardId} is not one`)
            seen.add(cardId)
        }
        return seen
    }
    const atSites = Object.values(state.denizensBySite).flat()
    const held = state.players.flatMap((player) => [
        ...player.knownHand(),
        ...player.knownAdviserIds()
    ])
    const world = [
        ...vault.worldDeck,
        ...Object.values(vault.discardPiles).flat(),
        ...held,
        ...state.boxIds
    ]
    const denizens = once(
        'Denizens',
        [
            ...world.filter((cardId) => kindOf(cardId) === CardKind.Denizen),
            ...atSites.filter((cardId) => kindOf(cardId) === CardKind.Denizen),
            ...vault.dispossessed
        ],
        PRINTED_DENIZEN_IDS
    )
    const inGame = denizensInCirculation(state.chronicleRecord ?? []) + vault.dispossessed.length
    if (denizens.size !== inGame) breaches.push(`Denizens: ${denizens.size} in play, not ${inGame}`)
    if (vault.dispossessed.length !== state.dispossessedCount)
        breaches.push(`the Dispossessed is counted ${state.dispossessedCount}`)

    const visions = once('Visions', world.filter(isVision), ALL_VISION_IDS)
    if (visions.size !== ALL_VISION_IDS.length) breaches.push(`Visions: ${visions.size} of 5`)
    if (state.worldDeckVisions !== vault.worldDeck.filter(isVision).length)
        breaches.push(`the world deck's Visions are counted ${state.worldDeckVisions}`)

    const slotSites = state.allSiteIds().flatMap((slotId) => {
        const sites = [state.siteCards[slotId], vault.siteFacedown[slotId]].filter(
            (cardId) => cardId !== undefined
        )
        if (sites.length !== 1) breaches.push(`${slotId} holds ${sites.length} sites`)
        return sites
    })
    const sites = once('Sites', [...slotSites, ...vault.siteDeck], ALL_SITE_IDS)
    if (sites.size !== ALL_SITE_IDS.length) breaches.push(`Sites: ${sites.size} of 23`)

    const relicSlots = [...state.reliquarySlots(), ...Object.values(state.relicsBySite).flat()]
    const placedRelics = relicSlots.map((slot) => vault.relicFacedown[slot.slotId])
    if (placedRelics.some((cardId) => cardId === undefined))
        breaches.push('a relic slot holds no relic')
    if (Object.keys(vault.relicFacedown).length !== relicSlots.length)
        breaches.push('the vault holds a relic in no slot')
    const relics = once(
        'Relics',
        [
            ...state.players.flatMap((player) => player.relicIds),
            ...placedRelics.filter((cardId) => cardId !== undefined),
            ...vault.relicDeck
        ],
        ALL_RELIC_IDS
    )
    if (relics.size !== ALL_RELIC_IDS.length) breaches.push(`Relics: ${relics.size} of 21`)
    if (!state.getPlayerState(state.chancellorId()).relicIds.includes(GRAND_SCEPTER_ID))
        breaches.push('the Chancellor does not hold the Grand Scepter')

    const edifices = once(
        'Edifices',
        atSites.filter((cardId) => kindOf(cardId) === CardKind.Edifice),
        EDIFICE_DEFINITIONS.map((edifice) => edifice.id)
    )
    if (edifices.size > EDIFICE_DEFINITIONS.length) breaches.push('more than six edifices')
    return breaches
}

/**
 * A thin fixture made whole for R-8: every Vision, site and relic it leaves out is put where a game
 * keeps the ones no player has seen — Visions in the world deck, sites in the facedown slots that
 * name none and then in the site deck, relics on the Reliquary's empty spaces and then in the relic
 * deck (the Grand Scepter in the deck, as Relic Hunter can leave it). Denizens need nothing: the
 * Archive is every one the game does not hold.
 */
export function wholeWorld(state: HydratedOathGameState): HydratedOathGameState {
    const vault = state.requireVault()
    const held = new Set([
        ...vault.worldDeck,
        ...Object.values(vault.discardPiles).flat(),
        ...vault.dispossessed,
        ...state.boxIds,
        ...state.players.flatMap((player) => [
            ...player.knownAdviserIds(),
            ...player.knownHand(),
            ...player.relicIds,
            ...(player.revealedVisionId !== undefined ? [player.revealedVisionId] : [])
        ]),
        ...Object.values(state.siteCards),
        ...Object.values(vault.siteFacedown),
        ...vault.siteDeck,
        ...Object.values(vault.relicFacedown),
        ...vault.relicDeck
    ])
    const visions = ALL_VISION_IDS.filter((cardId) => !held.has(cardId))
    vault.worldDeck.push(...visions)
    state.worldDeckVisions += visions.length
    const sites = ALL_SITE_IDS.filter((cardId) => !held.has(cardId))
    for (const slotId of state.allSiteIds()) {
        if (state.isSiteFaceup(slotId) || vault.siteFacedown[slotId] !== undefined) continue
        const siteCardId = sites.shift()
        if (siteCardId !== undefined) vault.siteFacedown[slotId] = siteCardId
    }
    vault.siteDeck.push(...sites)
    const relics = RELIC_DECK_IDS.filter((cardId) => !held.has(cardId))
    const emptySpaces = [
        ...state.reliquarySlots(),
        ...Object.values(state.relicsBySite).flat()
    ].filter((slot) => vault.relicFacedown[slot.slotId] === undefined)
    for (const slot of emptySpaces) {
        const relicCardId = relics.shift()
        if (relicCardId !== undefined) vault.relicFacedown[slot.slotId] = relicCardId
    }
    vault.relicDeck.push(...relics)
    if (!held.has(GRAND_SCEPTER_ID)) vault.relicDeck.push(GRAND_SCEPTER_ID)
    return state
}

/**
 * The world a chronicle leaves, checked whole (host-side): each card of the game in exactly one
 * place, nothing left in a hand, an adviser row, a pile or the Reliquary, and the map the
 * positional stack R-8.7.1 saves. Returns every breach found; an empty list is a sound world.
 */
export function chronicleCensus(state: HydratedOathGameState): string[] {
    const vault = state.requireVault()
    const breaches: string[] = []
    const once = (what: string, placed: readonly string[], universe: readonly string[]) => {
        const counts = new Map<string, number>()
        for (const cardId of placed) counts.set(cardId, (counts.get(cardId) ?? 0) + 1)
        for (const [cardId, n] of counts) {
            if (n > 1) breaches.push(`${what}: ${cardId} is in ${n} places`)
            if (!universe.includes(cardId)) breaches.push(`${what}: ${cardId} is not one`)
        }
        return counts
    }
    const empty = (what: string, cardIds: readonly unknown[]) => {
        if (cardIds.length > 0) breaches.push(`${what} still holds ${cardIds.length}`)
    }

    // R-8.5, R-8.6, R-8.8 — nothing is left where the next game deals from scratch.
    for (const player of state.players) {
        empty(`${player.playerId}'s advisers`, player.knownAdviserIds())
        empty(`${player.playerId}'s hand`, player.knownHand())
        empty(`${player.playerId}'s relics`, player.relicIds)
        if (player.revealedVisionId !== undefined)
            breaches.push(`${player.playerId} still shows ${player.revealedVisionId}`)
        if (player.siteId !== undefined) breaches.push(`${player.playerId}'s pawn is on the map`)
    }
    for (const region of Object.values(Region)) {
        empty(`the ${region} pile`, vault.discardPiles[region])
        if (state.discardPileCounts[region] !== 0)
            breaches.push(`the ${region} pile is counted ${state.discardPileCounts[region]}`)
    }
    empty('the Reliquary', state.reliquarySlots())
    if (state.chronicle?.returnedDenizenId !== undefined)
        breaches.push(`${state.chronicle.returnedDenizenId} never reached the world deck`)
    if (state.dispossessedCount !== vault.dispossessed.length)
        breaches.push(`the Dispossessed is counted ${state.dispossessedCount}`)

    // Denizens: the world deck, the sites and the Dispossessed; the Archive is the rest of the 198.
    const atSites = Object.values(state.denizensBySite).flat()
    const denizens = [
        ...vault.worldDeck.filter((cardId) => !isVision(cardId)),
        ...atSites.filter((cardId) => kindOf(cardId) === CardKind.Denizen),
        ...vault.dispossessed
    ]
    once('Denizens', denizens, PRINTED_DENIZEN_IDS)

    // Visions: all five in the world deck, two in its top pile and three in the next (R-8.8).
    const deckVisions = vault.worldDeck.filter(isVision)
    const visionCounts = once('Visions', deckVisions, ALL_VISION_IDS)
    if (visionCounts.size !== ALL_VISION_IDS.length)
        breaches.push(`Visions: ${visionCounts.size} of ${ALL_VISION_IDS.length} in the world deck`)
    if (state.boxIds.some(isVision)) breaches.push('a Vision is still in the box')
    const deckDenizens = vault.worldDeck.length - deckVisions.length
    const top = Math.min(TOP_PILE_DENIZENS, deckDenizens) + 2
    const second = Math.min(SECOND_PILE_DENIZENS, deckDenizens - top + 2) + 3
    const visionsIn = (from: number, to: number) =>
        vault.worldDeck.slice(from, to).filter(isVision).length
    if (visionsIn(0, top) !== 2 || visionsIn(top, top + second) !== 3)
        breaches.push('Visions: not two in the top pile and three in the next')
    if (state.worldDeckVisions !== deckVisions.length)
        breaches.push(`the world deck's Visions are counted ${state.worldDeckVisions}`)

    // Sites: one in each of the eight slots, the rest in the site deck.
    const slotSites = state.allSiteIds().flatMap((slotId) => {
        const faceup = state.siteCardAt(slotId)
        const facedown = vault.siteFacedown[slotId]
        if ((faceup === undefined) === (facedown === undefined))
            breaches.push(`${slotId} does not hold exactly one site`)
        return [faceup, facedown].filter((cardId) => cardId !== undefined)
    })
    const siteCounts = once('Sites', [...slotSites, ...vault.siteDeck], ALL_SITE_IDS)
    if (siteCounts.size !== ALL_SITE_IDS.length)
        breaches.push(`Sites: ${siteCounts.size} of ${ALL_SITE_IDS.length}`)

    // Relics: the relic deck and the sites hold the 20; the Grand Scepter is boxed (R-8.6.1-H1).
    const siteRelicSlots = Object.values(state.relicsBySite).flat()
    const siteRelics = siteRelicSlots.map((slot) => vault.relicFacedown[slot.slotId])
    if (siteRelics.some((cardId) => cardId === undefined))
        breaches.push('a relic slot at a site holds no relic')
    if (Object.keys(vault.relicFacedown).length !== siteRelicSlots.length)
        breaches.push('the vault holds a relic at no site')
    const relicCounts = once(
        'Relics',
        [...vault.relicDeck, ...siteRelics.filter((cardId) => cardId !== undefined)],
        RELIC_DECK_IDS
    )
    if (relicCounts.size !== RELIC_DECK_IDS.length)
        breaches.push(
            `Relics: ${relicCounts.size} of ${RELIC_DECK_IDS.length} in the deck and at sites`
        )
    if (state.boxIds.filter((cardId) => cardId === GRAND_SCEPTER_ID).length !== 1)
        breaches.push('the Grand Scepter is not in the box once')
    if (ALL_RELIC_IDS.length !== RELIC_DECK_IDS.length + 1) breaches.push('the relics are not 21')

    // Edifices: at the sites, the rest in the Archive; ruins only in the Provinces or Hinterland.
    once(
        'Edifices',
        atSites.filter((cardId) => kindOf(cardId) === CardKind.Edifice),
        EDIFICE_DEFINITIONS.map((edifice) => edifice.id)
    )
    for (const slotId of state.map[Region.Cradle])
        if (state.denizensAt(slotId).some((cardId) => state.isRuined(cardId)))
            breaches.push(`a ruin is in the Cradle at ${slotId}`)
    for (const region of Object.values(Region))
        if (!state.map[region].some((slotId) => state.isSiteFaceup(slotId)))
            breaches.push(`the ${region} has no faceup site`)

    // R-8.3.4 — no piece is left on the map.
    for (const [slotId, counts] of Object.entries(state.warbandsBySite))
        if (warbandEntries(counts).some(([, n]) => n > 0)) breaches.push(`warbands at ${slotId}`)
    for (const [cardId, tokens] of Object.entries(state.cardTokens))
        if (tokens.favor > 0 || tokens.secrets > 0) breaches.push(`tokens on ${cardId}`)
    for (const [cardId, counts] of Object.entries(state.warbandsOnCards))
        if (warbandEntries(counts).some(([, n]) => n > 0)) breaches.push(`warbands on ${cardId}`)
    return breaches
}
