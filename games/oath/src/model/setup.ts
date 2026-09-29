import { assertExists, shuffle, type RandomFunction } from '@tabletop/common'
import { HydratedOathGameState, discardRegionFor, type RelicSlot } from './gameState.js'
import type { HydratedOathPlayerState, OathPlayerState } from './playerState.js'
import { Banner, CardKind, OathType, PlayerStatus, Region, TOTAL_FAVOR } from './oathEnums.js'
import { createOathVault, drawFromBottomOfWorldDeck, drawRelics, type OathVault } from './vault.js'
import { allMapSlots, TOP_CRADLE_SLOT } from '../data/mapSlots.js'
import { ALL_SITE_IDS } from '../data/sites.js'
import { GRAND_SCEPTER_ID, RELIC_DECK_IDS, RELIQUARY_SIZE } from '../data/relics.js'
import {
    composeFirstGameDeck,
    SetupVariant,
    SETUP_DISCARD_SEED_CARDS,
    SETUP_HAND_SIZE,
    setupDrawTotal,
    visionFreeTailLength
} from '../data/worldDeck.js'
import { siteRevealPrompt } from '../data/cardRegistry.js'
import { bySuit } from '../data/typedData.js'
import { PLAYTEST_DECK, PLAYTEST_SITES } from '../data/playtestDeck.js'
import { visionsDrawnAfter } from '../data/visionsDrawnTrack.js'
import { discardCards } from '../util/discard.js'
import { MAX_SUPPLY } from '../util/rest.js'
import { addWarbandsToSite, takeWarbandsFromBank } from '../util/force.js'
import { gainWarbandsToBoard } from '../powers/vocabulary.js'
import type { SetupChoice, SetupChoiceMetadata } from '../actions/setupChoice.js'

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
/** R-1.15 */
export const EXILE_BOARD_WARBANDS = 3
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

/** R-10.13 — each seat's own colour; the Chancellor's is purple. */
export function warbandOwnersBySeat(
    players: readonly Pick<OathPlayerState, 'playerId' | 'color'>[]
): Record<string, string> {
    return Object.fromEntries(players.map((player) => [player.color, player.playerId]))
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

    if (context.setupVariant) {
        state.setupVariant = context.setupVariant
    }

    // R-1.1
    const { map, siteCards } = dealFaceupSites(
        context.random,
        context.setupVariant === SetupVariant.Curated ? PLAYTEST_SITES : ALL_SITE_IDS
    )
    state.map = map
    state.siteCards = siteCards

    state.denizensBySite = {}
    state.relicsBySite = {}
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
    // R-10.13 — colours are fixed at seating, and the Chancellor's purple returns to them.
    state.warbandOwnerPlayerId = warbandOwnersBySeat(orderedPlayers)
    for (const player of orderedPlayers) {
        const isChancellor = player.playerId === chancellor.playerId

        player.warbandsOnBoard = {}
        player.warbandsInPersonalBank = {
            [player.color]: isChancellor ? CHANCELLOR_WARBANDS : EXILE_WARBANDS
        }

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

        // R-1.15 — a Citizen places purple, so the colour comes off the player.
        if (!isChancellor) {
            gainWarbandsToBoard(state, player.playerId, EXILE_BOARD_WARBANDS)
        }
    }

    // R-1.12
    placeChancellorWarbands(state, chancellor)

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
    state.reliquary = Array.from(
        { length: RELIQUARY_SIZE },
        (_, i): RelicSlot => ({ slotId: reliquarySlotId(i) })
    )

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

/** R-1.12 — 3 on the board and 2 on the topmost faceup Cradle site; setup deals no denizen, so no other site is occupied. */
function placeChancellorWarbands(
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
        chancellor.color,
        takeWarbandsFromBank(state, chancellor.color, TOP_CRADLE_WARBANDS)
    )
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

/** R-1.16 — only the Chancellor splits, all the bank holds, no site above what it prints. */
function reasonSiteFavorInvalid(
    state: HydratedOathGameState,
    status: PlayerStatus,
    split: SetupChoiceInput['siteFavor']
): string | undefined {
    const pending = state.pendingSiteFavor
    const chancellor = status === PlayerStatus.Chancellor
    if (!pending || !chancellor) {
        return split
            ? "only the Chancellor splits the sites' favor, and only when it runs short"
            : undefined
    }
    if (!split) return 'the favor runs short: the Chancellor chooses how to place it on the sites'
    for (const { siteCardId, favor } of split) {
        const site = pending.find((p) => p.siteCardId === siteCardId)
        if (!site) return `${siteCardId} is not a site waiting for favor`
        if (favor < 0 || favor > site.wanted) {
            return `${siteCardId} takes between 0 and ${site.wanted} favor`
        }
    }
    if (new Set(split.map((s) => s.siteCardId)).size !== split.length) {
        return 'each site is named once'
    }
    const placed = split.reduce((n, s) => n + s.favor, 0)
    if (placed !== state.favorSupply) {
        return `all ${state.favorSupply} favor left in the bank is placed, not ${placed}`
    }
    return undefined
}

/** R-2.8.2, R-9.4 — the identity is dealt by `buildSetupVault`. */
export function placeSiteRevealRelicSlots(state: HydratedOathGameState): void {
    for (const slotId of state.faceupSiteIds()) {
        const count = siteRevealPrompt(state.siteCardAt(slotId))?.relics ?? 0
        if (count === 0) continue
        state.relicsBySite[slotId] = Array.from({ length: count }, (_, i) => ({
            slotId: `${slotId}.relic.${i}`
        }))
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
function takeFavorFromSupply(state: HydratedOathGameState, amount: number): number {
    const taken = Math.max(0, Math.min(amount, state.favorSupply))
    state.favorSupply -= taken
    return taken
}

/** R-1.1, R-1.17, R-1.18, R-1.21 — shuffled from the protected stream (R-9.4). */
export function buildSetupVault(state: HydratedOathGameState, random: RandomFunction): OathVault {
    const faceup = new Set(Object.values(state.siteCards))
    const pool = state.setupVariant === SetupVariant.Curated ? PLAYTEST_SITES : ALL_SITE_IDS
    const remainingSites = pool.filter((id) => !faceup.has(id))

    const vault = createOathVault(
        {
            // R-1.21
            composeWorldDeck: (random) =>
                composeFirstGameDeck(
                    random,
                    state.setupVariant === SetupVariant.Curated ? PLAYTEST_DECK : undefined
                ),
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

    // R-1.17
    const reliquaryRelics = drawRelics(vault, RELIQUARY_SIZE)
    if (reliquaryRelics.length < RELIQUARY_SIZE) {
        throw Error(
            `R-1.17 draws ${RELIQUARY_SIZE} relics for the Imperial Reliquary; the ` +
                `relic deck supplied ${reliquaryRelics.length}. Relic data is a ` +
                `placeholder — see data/relics.ts.`
        )
    }
    reliquaryRelics.forEach((cardId, i) => {
        vault.relicFacedown[reliquarySlotId(i)] = cardId
    })

    // R-2.8.2 — after the Reliquary: the seeded draw order depends on it.
    for (const slotId of state.allSiteIds()) {
        if (!state.isSiteFaceup(slotId)) continue
        for (const slot of state.relicSlotsAt(slotId)) {
            const [relicCardId] = drawRelics(vault, 1)
            if (!relicCardId) {
                throw Error(
                    `R-2.8.2: the relic deck ran out seeding faceup site ${slotId}. ` +
                        `Relic data is a placeholder — see data/relics.ts.`
                )
            }
            vault.relicFacedown[slot.slotId] = relicCardId
        }
    }

    // R-8.8 — no Visions are drawn at setup, so the bottom draws must fit the Vision-free tail.
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
    for (const region of Object.values(Region)) {
        state.discardPileCounts[region] += result.discardSeedCounts[region] ?? 0
        const back = result.discardSeedTopBackType?.[region]
        if (back) {
            state.discardTopBackType = { ...state.discardTopBackType, [region]: back }
        }
    }

    // R-1.20
    for (const hand of result.hands) {
        state.getPlayerState(hand.playerId).setHand(hand.cardIds)
    }

    // R-1.22
    state.visionsDrawn = visionsDrawnAfter(state.visionsDrawn, result.visionsDrawn)

    state.topCardBackType = result.topCardBackType
    state.worldDeckExhausted = result.worldDeckExhausted
}

/** R-1.23.1–R-1.23.3, taken as explicit action input per R-X.1. */
export type SetupChoiceInput = Pick<
    SetupChoice,
    'siteId' | 'adviserCardId' | 'discardOrder' | 'siteFavor'
>

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

export function reasonCannotSetupChoice(
    state: HydratedOathGameState,
    playerId: string,
    choice: SetupChoiceInput
): string | undefined {
    const player = state.getPlayerState(playerId)
    if (player.siteId !== undefined) return 'player has already resolved setup'
    if (nextSetupPlayerId(state) !== playerId) {
        return `R-1.23 resolves in turn order; ${nextSetupPlayerId(state)} is next`
    }

    // R-1.23.1
    if (!state.allSiteIds().includes(choice.siteId)) {
        return `${choice.siteId} is not a site on the map`
    }
    if (!state.isSiteFaceup(choice.siteId)) {
        return `${choice.siteId} is facedown; R-1.23.1 places a pawn on a faceup site`
    }
    if (player.status === PlayerStatus.Chancellor && choice.siteId !== TOP_CRADLE_SLOT) {
        return 'R-1.23.1 puts the Chancellor on the top Cradle site'
    }

    // R-1.23.2, R-1.23.3, R-9.5
    const kept = [choice.adviserCardId, ...choice.discardOrder]
    const hand = [...player.knownHand()].sort()
    if (kept.length !== hand.length || [...kept].sort().join() !== hand.join()) {
        return `R-1.23.2 and R-1.23.3 must name exactly the ${hand.length} cards drawn`
    }
    if (choice.discardOrder.includes(choice.adviserCardId)) {
        return 'a card cannot be both the adviser and discarded'
    }
    const siteFavorReason = reasonSiteFavorInvalid(state, player.status, choice.siteFavor)
    if (siteFavorReason) return siteFavorReason
    return undefined
}

/** R-1.23.1 to R-1.23.3 in order: R-10.5 discards from where the pawn now stands. */
export function applySetupChoice(
    state: HydratedOathGameState,
    playerId: string,
    choice: SetupChoiceInput
): SetupChoiceMetadata {
    const reason = reasonCannotSetupChoice(state, playerId, choice)
    if (reason) {
        throw Error(`Cannot resolve setup for ${playerId}: ${reason}`)
    }
    const player = state.getPlayerState(playerId)

    // R-1.16
    for (const { siteCardId, favor } of choice.siteFavor ?? []) {
        state.addTokensOn(siteCardId, { favor: takeFavorFromSupply(state, favor), secrets: 0 })
    }
    if (choice.siteFavor) state.pendingSiteFavor = undefined

    // R-1.23.1
    player.siteId = choice.siteId

    // R-1.23.2
    player.addAdviser(choice.adviserCardId, false)

    // R-1.23.3
    const region = state.regionOf(choice.siteId)
    player.setHand([])
    discardCards(state, playerId, choice.discardOrder, region)

    return {
        discardPileRegion: discardRegionFor(region),
        discardedCardIds: [...choice.discardOrder]
    }
}
