import { assertExists, shuffle, type RandomFunction } from '@tabletop/common'
import { HydratedOathGameState, type RelicSlot } from '../model/gameState.js'
import type { HydratedOathPlayerState } from '../model/playerState.js'
import {
    Banner,
    CardKind,
    OathType,
    PlayerStatus,
    Region,
    SetupVariant,
    TOTAL_FAVOR
} from '../model/oathEnums.js'
import { TOTAL_VISIONS } from '../data/worldDeck.js'
import {
    carriedOathVault,
    createOathVault,
    drawFromBottomOfWorldDeck,
    drawRelics,
    type OathVault
} from '../model/vault.js'
import { allMapSlots } from '../data/mapSlots.js'
import { ALL_SITE_IDS } from '../data/sites.js'
import { GRAND_SCEPTER_ID, RELIC_DECK_IDS, RELIQUARY_SIZE } from '../data/relics.js'
import {
    composeFirstGameDeck,
    SETUP_DISCARD_SEED_CARDS,
    SETUP_HAND_SIZE,
    setupDrawTotal,
    visionFreeTailLength
} from '../data/worldDeck.js'
import { siteRevealPrompt } from '../data/cardRegistry.js'
import { bySuit } from '../data/typedData.js'
import { visionsDrawnAfter } from '../data/visionsDrawnTrack.js'
import { MAX_SUPPLY } from './rest.js'
import {
    addWarbandsToBoard,
    addWarbandsToSite,
    gainWarbandsToBoard,
    takeWarbandsFromBank
} from './force.js'
import { IMPERIAL_WARBANDS } from '../model/warbandCounts.js'

/** R-1.6 — 3 favor per bank, or 4 each at five or six players. */
export function favorPerBank(playerCount: number): number {
    return playerCount >= 5 ? 4 : 3
}

/** R-1.8 */
export const CHANCELLOR_WARBANDS = 24
/** R-1.9 */
export const EXILE_WARBANDS = 14
/** R-1.12 */
export const CHANCELLOR_BOARD_WARBANDS = 3
/** R-1.12 */
export const TOP_CRADLE_WARBANDS = 2
/** R-1.12 */
export const SITE_GARRISON_WARBANDS = 1
/** R-1.15 */
export const EXILE_BOARD_WARBANDS = 3
/** R-1.15 — purple, from the Imperial bank. */
export const CITIZEN_BOARD_WARBANDS = 3
/** R-1.11 */
export const CHANCELLOR_START_FAVOR = 2
export const CHANCELLOR_START_SECRETS = 1
/** R-1.15 */
export const EXILE_START_FAVOR = 1
export const EXILE_START_SECRETS = 1
/** R-1.5 */
export const BANNER_START_VALUE = 1

/** R-2.3, R-1.17 */
export function reliquarySlotId(index: number): string {
    return `reliquary.${index}`
}

/** R-1.1, R-8.3.5.7 — a first game flips the top site of each region; the rest are dealt facedown. */
function dealFaceupSites(
    random: RandomFunction,
    pool: readonly string[]
): { map: Record<Region, string[]>; siteCards: Record<string, string> } {
    const map = allMapSlots()
    const available = [...pool]
    shuffle(available, random)

    const siteCards: Record<string, string> = {}
    for (const region of Object.values(Region)) {
        const flipped = available.shift()
        assertExists(flipped, `R-8.3.5.7: no site left to flip faceup in ${region}`)
        siteCards[map[region][0]] = flipped
    }
    return { map, siteCards }
}

export interface SetupContext {
    oathType: OathType
    /** Chancellor first (R-1.7, R-4). */
    turnOrder: string[]
    /** The state's public stream; never the deck (R-9.4). */
    random: RandomFunction
    setupVariant?: SetupVariant
    /** A continued game's map, dealt as the last game saved it; absent in a first game. */
    carried?: CarriedMap
}

/**
 * R-8.7.1, R-1.1 — the eight slots as the last game saved them (A-37): each slot's site with its
 * facing, its denizens and edifice, its relic slots, and the capacity a Salt the Earth still on it
 * sets (R-7-H1). The facedown sites' identities stay in the vault.
 */
export interface CarriedMap {
    map: Record<Region, string[]>
    siteCards: Record<string, string>
    denizensBySite: Record<string, string[]>
    relicsBySite: Record<string, RelicSlot[]>
    ruinedEdificeIds?: string[]
    siteCapacityOverrides: Record<string, number>
}

/** R-1.1 with R-8.7.1 — the stack is dealt as it was stacked: no site moves and none flips (A-37). */
function dealCarriedSites(state: HydratedOathGameState, carried: CarriedMap): void {
    state.map = structuredClone(carried.map)
    state.siteCards = { ...carried.siteCards }
    state.denizensBySite = structuredClone(carried.denizensBySite)
    state.relicsBySite = structuredClone(carried.relicsBySite)
    if (carried.ruinedEdificeIds) state.ruinedEdificeIds = [...carried.ruinedEdificeIds]
    state.siteCapacityOverrides = { ...carried.siteCapacityOverrides }
    // R-8.3.5 step 7 runs inside the chronicle, so a first game's flip never runs here (A-37).
    for (const region of Object.values(Region)) {
        if (!state.map[region].some((slotId) => state.isSiteFaceup(slotId))) {
            throw Error(
                `R-8.3.5 step 7 leaves a faceup site in every region, but the carried ${region} ` +
                    'has none'
            )
        }
    }
}

/** R-1.2 and the public halves of R-1.4 through R-1.18, in the Law's order. */
export function buildInitialPublicState(
    state: HydratedOathGameState,
    context: SetupContext
): HydratedOathGameState {
    const { oathType } = context
    const orderedPlayers = context.turnOrder.map((playerId) => state.getPlayerState(playerId))
    const playerCount = orderedPlayers.length
    const chancellor = orderedPlayers[0]

    // R-1.2
    state.round = 1
    state.visionsDrawn = 0
    state.worldDeckDrawn = 0
    // R-8.5 — every Vision starts in the world deck.
    state.worldDeckVisions = TOTAL_VISIONS

    if (context.setupVariant) {
        state.setupVariant = context.setupVariant
    }

    // R-1.1
    if (context.carried) {
        dealCarriedSites(state, context.carried)
    } else {
        const { map, siteCards } = dealFaceupSites(context.random, ALL_SITE_IDS)
        state.map = map
        state.siteCards = siteCards

        state.denizensBySite = {}
        state.relicsBySite = {}
    }
    state.warbandsBySite = {}
    state.cardTokens = {}

    // R-1.4 — all 36 favor start in the shared bank; R-9.3 exempts secrets and dice.
    state.favorSupply = TOTAL_FAVOR

    // R-1.5 — zero here would break R-5.4.2, R-2.5.2 and R-2.5.3.
    state.banners = {
        [Banner.PeoplesFavor]: { value: BANNER_START_VALUE, mobSide: false },
        [Banner.DarkestSecret]: { value: BANNER_START_VALUE }
    }
    takeFavorFromSupply(state, BANNER_START_VALUE)

    // R-1.6
    const perBank = favorPerBank(playerCount)
    state.favorBank = bySuit(() => takeFavorFromSupply(state, perBank))

    // R-1.8 through R-1.15
    state.chancellorPlayerId = chancellor.playerId
    for (const player of orderedPlayers) {
        const isChancellor = player.playerId === chancellor.playerId

        player.warbandsOnBoard = {}
        // R-1.8 — the Chancellor's bank is the Empire's warbands.
        player.warbandsInPersonalBank = isChancellor
            ? { [IMPERIAL_WARBANDS]: CHANCELLOR_WARBANDS }
            : { [player.playerId]: EXILE_WARBANDS }

        // R-1.10 — leftmost is the maximum, not zero.
        player.supply = MAX_SUPPLY
        player.supplyAtTurnStart = MAX_SUPPLY
        player.supplySpentThisTurn = 0

        if (isChancellor) {
            player.favor = takeFavorFromSupply(state, CHANCELLOR_START_FAVOR)
            player.secrets = CHANCELLOR_START_SECRETS
            player.relicIds = [GRAND_SCEPTER_ID]
        } else {
            player.favor = takeFavorFromSupply(state, EXILE_START_FAVOR)
            player.secrets = EXILE_START_SECRETS
            player.relicIds = []
        }
        player.secretsFacedown = 0

        // R-1.15 — each Exile's own warbands; the Chancellor's are placed by R-1.12, and a
        // Citizen's after it.
        if (!isChancellor && player.status !== PlayerStatus.Citizen) {
            gainWarbandsToBoard(state, player.playerId, EXILE_BOARD_WARBANDS)
        }
    }

    // R-1.12
    placeChancellorWarbands(state, chancellor)

    // R-1.15 — "Each Citizen places 3 purple warbands on their board": a continued game's Citizen
    // side (R-1.9-H1), from what R-1.12 left in the Imperial bank (R-9.3).
    for (const player of orderedPlayers) {
        if (player.status !== PlayerStatus.Citizen) continue
        addWarbandsToBoard(
            state,
            player.playerId,
            IMPERIAL_WARBANDS,
            takeWarbandsFromBank(state, IMPERIAL_WARBANDS, CITIZEN_BOARD_WARBANDS)
        )
    }

    // R-1.13
    state.oathType = oathType
    if (oathType === OathType.Devotion) {
        state.banners[Banner.DarkestSecret].holderPlayerId = chancellor.playerId
    } else if (oathType === OathType.ThePeople) {
        state.banners[Banner.PeoplesFavor].holderPlayerId = chancellor.playerId
    }

    // R-1.14
    state.oathkeeperPlayerId = chancellor.playerId
    state.oathkeeperIsUsurper = false

    // R-1.16 — paid last, after every other payout.
    placeSetupSiteTokens(state)

    // R-2.8.2
    placeSiteRevealRelicSlots(state)

    // R-1.17, R-9.4 — the identities are dealt by `buildSetupVault`.
    state.reliquary = Array.from({ length: RELIQUARY_SIZE }, (_, i): RelicSlot => ({
        slotId: reliquarySlotId(i)
    }))

    // R-1.18, R-1.21 — the decks live in the vault; public state carries only what R-9.4 permits.
    state.worldDeckExhausted = false
    state.topCardBackType = undefined
    state.discardPileCounts = {
        [Region.Cradle]: 0,
        [Region.Provinces]: 0,
        [Region.Hinterland]: 0
    }
    state.boxIds = []

    return state
}

/** R-1.12 — a faceup site holding a denizen or an intact edifice. */
export function takesSetupGarrison(state: HydratedOathGameState, slotId: string): boolean {
    return (
        state.isSiteFaceup(slotId) &&
        state.denizensAt(slotId).some((cardId) => !state.isRuined(cardId))
    )
}

/** R-1.12 — 3 on the board, 2 on the topmost faceup Cradle site and 1 on each other garrisoned site. */
export function placeChancellorWarbands(
    state: HydratedOathGameState,
    chancellor: HydratedOathPlayerState
): void {
    gainWarbandsToBoard(state, chancellor.playerId, CHANCELLOR_BOARD_WARBANDS)

    const topCradle = state.map[Region.Cradle].find((slotId) => state.isSiteFaceup(slotId))
    if (!topCradle) {
        throw Error(
            'R-1.12 needs a faceup Cradle site, and R-1.23.1 needs the top one — ' +
                'the map deal produced neither'
        )
    }
    addWarbandsToSite(
        state,
        topCradle,
        IMPERIAL_WARBANDS,
        takeWarbandsFromBank(state, IMPERIAL_WARBANDS, TOP_CRADLE_WARBANDS)
    )
    for (const slotId of state.faceupSiteIds()) {
        if (slotId === topCradle || !takesSetupGarrison(state, slotId)) continue
        addWarbandsToSite(
            state,
            slotId,
            IMPERIAL_WARBANDS,
            takeWarbandsFromBank(state, IMPERIAL_WARBANDS, SITE_GARRISON_WARBANDS)
        )
    }
}

/** R-1.16 — "if there is not enough favor, the Chancellor chooses how to place it": the favor then waits for their setup choice. */
export function placeSetupSiteTokens(state: HydratedOathGameState): void {
    const prompted = state.faceupSiteIds().flatMap((slotId) => {
        const siteCardId = state.siteCardAt(slotId)
        const prompt = siteRevealPrompt(siteCardId)
        return siteCardId && prompt ? [{ siteCardId, prompt }] : []
    })
    const wanted = prompted.reduce((n, { prompt }) => n + prompt.favor, 0)
    if (wanted <= state.favorSupply) {
        for (const slotId of state.faceupSiteIds()) placeRevealTokensForSite(state, slotId)
        return
    }
    for (const { siteCardId, prompt } of prompted) {
        if (prompt.secrets > 0) state.addTokensOn(siteCardId, { favor: 0, secrets: prompt.secrets })
    }
    state.pendingSiteFavor = prompted
        .filter(({ prompt }) => prompt.favor > 0)
        .map(({ siteCardId, prompt }) => ({ siteCardId, wanted: prompt.favor }))
}

/**
 * R-2.8.2, R-9.4 — the identity is dealt by `buildSetupVault`. A carried site already holds the
 * relics R-8.6.2 gave it, and is given only what it lacks.
 */
export function placeSiteRevealRelicSlots(state: HydratedOathGameState): void {
    for (const slotId of state.faceupSiteIds()) {
        const count = siteRevealPrompt(state.siteCardAt(slotId))?.relics ?? 0
        const held = state.relicsBySite[slotId] ?? []
        if (count <= held.length) continue
        const named = new Set(held.map((slot) => slot.slotId))
        const added: RelicSlot[] = []
        for (let i = 0; held.length + added.length < count; i++) {
            const relicSlotId = `${slotId}.relic.${i}`
            if (!named.has(relicSlotId)) added.push({ slotId: relicSlotId })
        }
        state.relicsBySite[slotId] = [...held, ...added]
    }
}

/** R-2.8.2, R-5.6.2 — a mid-game reveal uses the same prompt. */
export function placeRevealTokensForSite(state: HydratedOathGameState, slotId: string): void {
    // Keyed by the site card: R-4.1.4's Opportunity reads tokens through `siteCardAt(slotId)`.
    const siteCardId = state.siteCardAt(slotId)
    const prompt = siteRevealPrompt(siteCardId)
    if (!prompt || !siteCardId) return

    if (prompt.favor === 0 && prompt.secrets === 0) return

    // R-9.3 — a mid-game reveal takes what the bank can give; secrets have no limit.
    state.addTokensOn(siteCardId, {
        favor: takeFavorFromSupply(state, prompt.favor),
        secrets: prompt.secrets
    })
}

/** R-9.3 — take as many as possible. */
export function takeFavorFromSupply(state: HydratedOathGameState, amount: number): number {
    const taken = Math.max(0, Math.min(amount, state.favorSupply))
    state.favorSupply -= taken
    return taken
}

/** R-1.1, R-1.17, R-1.18, R-1.21 — shuffled from the protected stream (R-9.4). */
export function buildSetupVault(state: HydratedOathGameState, random: RandomFunction): OathVault {
    const faceup = new Set(Object.values(state.siteCards))
    const remainingSites = ALL_SITE_IDS.filter((id) => !faceup.has(id))

    const vault = createOathVault(
        {
            // R-1.21
            composeWorldDeck: (random) => composeFirstGameDeck(random),
            // R-1.18 — less the Grand Scepter R-1.8 handed to the Chancellor.
            relicDeck: RELIC_DECK_IDS,
            siteDeck: remainingSites
        },
        random
    )

    // R-1.1, R-8.3.5.6
    for (const slotId of state.allSiteIds()) {
        if (state.isSiteFaceup(slotId)) continue
        const siteCardId = vault.siteDeck.shift()
        if (!siteCardId) {
            throw Error(`R-1.1: the site deck ran out before slot ${slotId} was filled`)
        }
        vault.siteFacedown[slotId] = siteCardId
    }

    drawSetupRelics(state, vault)

    // R-8.8, A-15 — a first game's bottom pile is denizens only (29 cards, more than six seats
    // draw), so its setup draws no Vision.
    const tail = visionFreeTailLength(vault.worldDeck)
    const needed = setupDrawTotal(state.players.length)
    if (tail < needed) {
        throw Error(
            `The world deck's Vision-free tail is ${tail} cards and setup draws ` +
                `${needed} from the bottom (R-1.19, R-1.20); no Visions are drawn at setup.`
        )
    }

    return vault
}

/**
 * R-8.7, R-1.1, R-1.17, R-1.18 — a continued game's vault: the facedown sites in their slots, the
 * relics at the sites, the world deck, the relic deck and the Dispossessed exactly as the last game
 * saved them. Only the site deck is new: the sites in no slot, shuffled from this game's protected
 * stream (R-9.4). R-1.19's and R-1.20's draws may reach a Vision (A-43).
 */
export function buildContinuedVault(
    state: HydratedOathGameState,
    saved: OathVault,
    random: RandomFunction
): OathVault {
    const siteFacedown: Record<string, string> = {}
    for (const slotId of state.allSiteIds()) {
        if (state.isSiteFaceup(slotId)) continue
        const siteCardId = saved.siteFacedown[slotId]
        if (siteCardId === undefined) {
            throw Error(`R-8.3.5 step 6 fills every slot, but the carried ${slotId} holds no site`)
        }
        siteFacedown[slotId] = siteCardId
    }
    const relicFacedown: Record<string, string> = {}
    for (const slot of Object.values(state.relicsBySite).flat()) {
        const relicCardId = saved.relicFacedown[slot.slotId]
        if (relicCardId !== undefined) relicFacedown[slot.slotId] = relicCardId
    }
    const inSlots = new Set([...Object.values(state.siteCards), ...Object.values(siteFacedown)])
    const siteDeck = ALL_SITE_IDS.filter((siteCardId) => !inSlots.has(siteCardId))
    shuffle(siteDeck, random)

    const vault = carriedOathVault({
        worldDeck: saved.worldDeck,
        siteFacedown,
        relicFacedown,
        relicDeck: saved.relicDeck,
        siteDeck,
        dispossessed: saved.dispossessed
    })
    drawSetupRelics(state, vault)
    return vault
}

/** R-1.17, then R-2.8.2's relics for the faceup sites' empty relic slots. */
function drawSetupRelics(state: HydratedOathGameState, vault: OathVault): void {
    // R-1.17
    const reliquaryRelics = drawRelics(vault, RELIQUARY_SIZE)
    if (reliquaryRelics.length < RELIQUARY_SIZE) {
        throw Error(
            `R-1.17 draws ${RELIQUARY_SIZE} relics for the Imperial Reliquary, but the ` +
                `relic deck held only ${reliquaryRelics.length}`
        )
    }
    reliquaryRelics.forEach((cardId, i) => {
        vault.relicFacedown[reliquarySlotId(i)] = cardId
    })

    // R-2.8.2 — after the Reliquary: the seeded draw order depends on it.
    for (const slotId of state.allSiteIds()) {
        if (!state.isSiteFaceup(slotId)) continue
        for (const slot of state.relicSlotsAt(slotId)) {
            // A carried site's relics are already there (R-8.6.2).
            if (vault.relicFacedown[slot.slotId] !== undefined) continue
            const [relicCardId] = drawRelics(vault, 1)
            if (!relicCardId) {
                throw Error(`R-2.8.2: the relic deck ran out seeding faceup site ${slotId}`)
            }
            vault.relicFacedown[slot.slotId] = relicCardId
        }
    }
}

/** R-1.20 */
export interface SetupHand {
    playerId: string
    cardIds: string[]
}

/** R-1.19–R-1.22 */
export interface SetupDealResult {
    /** R-1.19, R-9.4 — counts only; the fronts stay private. */
    discardSeedCounts: Record<Region, number>
    discardSeedTopBackType?: Partial<Record<Region, CardKind>>
    /** R-1.20 */
    hands: SetupHand[]
    /** R-1.22 */
    visionsDrawn: number
    /** R-9.4 */
    topCardBackType?: CardKind
    worldDeckExhausted: boolean
}

/** R-1.19 and R-1.20 draw from the BOTTOM of the world deck. Server-side only. */
export function resolveSetupDeal(vault: OathVault, orderedPlayerIds: string[]): SetupDealResult {
    // R-1.19
    const seed = drawFromBottomOfWorldDeck(vault, SETUP_DISCARD_SEED_CARDS)
    const regions = [Region.Cradle, Region.Provinces, Region.Hinterland]
    const discardSeedCounts: Record<Region, number> = {
        [Region.Cradle]: 0,
        [Region.Provinces]: 0,
        [Region.Hinterland]: 0
    }
    const discardSeedTopBackType: Partial<Record<Region, CardKind>> = {}
    seed.forEach((cardId, i) => {
        const region = regions[i % regions.length]
        vault.discardPiles[region].unshift(cardId)
        discardSeedCounts[region] += 1
        discardSeedTopBackType[region] = backTypeOf(cardId)
    })

    // R-1.20
    const hands = orderedPlayerIds.map((playerId) => ({
        playerId,
        cardIds: drawFromBottomOfWorldDeck(vault, SETUP_HAND_SIZE)
    }))

    // R-1.22 — counted from the hands only; R-1.19's cards are unseen (R-9.4).
    const visionsDrawn = hands
        .flatMap((hand) => hand.cardIds)
        .filter((cardId) => backTypeOf(cardId) === CardKind.Vision).length

    const top = vault.worldDeck[0]
    return {
        discardSeedCounts,
        discardSeedTopBackType,
        hands,
        visionsDrawn,
        topCardBackType: top === undefined ? undefined : backTypeOf(top),
        worldDeckExhausted: vault.worldDeck.length === 0
    }
}

function backTypeOf(cardId: string): CardKind {
    return cardId.startsWith(`${CardKind.Vision}.`) ? CardKind.Vision : CardKind.Denizen
}

/** R-1.19–R-1.22's public half; reads nothing from the vault. */
export function applySetupDeal(state: HydratedOathGameState, result: SetupDealResult): void {
    // R-1.19
    let seededVisions = 0
    for (const region of Object.values(Region)) {
        const seeded = result.discardSeedCounts[region] ?? 0
        state.discardPileCounts[region] += seeded
        // R-1.19 seeds each pile with one card, so its back is the top's: a denizen's in a first
        // game (A-15), and a continued game's may be a Vision's (A-43).
        const back = result.discardSeedTopBackType?.[region]
        state.seenDiscardPiles[region] = Array.from({ length: seeded }, () => ({
            back: back ?? CardKind.Denizen
        }))
        if (back) {
            state.discardTopBackType = { ...state.discardTopBackType, [region]: back }
        }
        if (back === CardKind.Vision) seededVisions += seeded
    }

    // R-1.20
    for (const hand of result.hands) {
        state.getPlayerState(hand.playerId).setHand(hand.cardIds)
    }

    // R-1.22 — a Vision in a hand moves the marker; one in R-1.19's piles is unseen and does not
    // (A-15, A-43). Every Vision dealt left the world deck, as its back showed.
    state.visionsDrawn = visionsDrawnAfter(state.visionsDrawn, result.visionsDrawn)
    state.worldDeckVisions -= result.visionsDrawn + seededVisions

    state.topCardBackType = result.topCardBackType
    state.worldDeckExhausted = result.worldDeckExhausted
}

/** R-1.23 — "starting with the Chancellor, each player in turn order"; undefined once done. */
export function nextSetupPlayerId(state: HydratedOathGameState): string | undefined {
    for (const playerId of state.turnManager.turnOrder) {
        const player = state.getPlayerState(playerId)
        // Keyed on the pawn: a player dealt a short hand (R-9.3) still owes R-1.23.1.
        if (player.siteId === undefined) {
            return playerId
        }
    }
    return undefined
}

export function isSetupComplete(state: HydratedOathGameState): boolean {
    return state.players.every((p) => p.handCount === 0 && p.siteId !== undefined)
}
