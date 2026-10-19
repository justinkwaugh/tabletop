import * as Type from 'typebox'
import { bannerHolder } from './oathkeeper.js'
import { siteHolding } from './access.js'
import { favorHomeBankOf, favorTakenFrom, gainFavorFromBank, settleBoardFavor } from './favor.js'
import { Banner, SearchPlay, CardKind, PlayerStatus, Region, Suit } from '../model/oathEnums.js'
import { ConspiracyPlay, type ConspiracyTake } from '../model/conspiracy.js'
import { isLockedFor } from './locked.js'
import { assertExists } from '@tabletop/common'
import { HydratedOathGameState } from '../model/gameState.js'
import { HiddenReveal } from '../model/hidden.js'
import { PowerOutcome } from '../model/powerOutcome.js'
import { cardDefinition, CONSPIRACY_ID, kindOf, suitOf } from '../data/cardRegistry.js'
import { effectiveSiteCapacity, SALT_THE_EARTH } from './capacity.js'
import {
    detachFromPlay,
    discardCards,
    noteSiteDiscard,
    siteDiscardLedgerKey,
    tokensReturnedBy,
    type DiscardTarget
} from './discard.js'
import { discardRevealedVision } from './revealedVision.js'
import { seizeBanner } from './seize.js'
import { powersWithTiming, PowerTiming } from '../data/cardPowers.js'
import {
    effectFor,
    type EffectContext,
    type FavorTake,
    type PlayGains,
    type PlayMapChanges
} from '../powers/registry.js'
import { pawnSiteId } from './pawn.js'
import { isFaceupPlay, powerOutcomeOf } from './powerDoorway.js'
import { PowerChoice, reasonChoicesInvalid } from './powerChoice.js'
import { modifierContext, type ActiveModifier } from './modifiers.js'
import {
    advisersTowardLimit,
    arrivesIgnoringAdviserLimit,
    cannotPlayVisionsFaceup,
    countsTowardAdviserLimit,
    effectiveAdviserLimit
} from './continuous.js'
import {
    advisersOfSuit,
    afterCardPlayedPersistent,
    reasonPersistentForbidsFacedownAdviser,
    reasonPersistentForbidsFaceupVision,
    reasonPersistentForbidsSecretCost,
    reasonPersistentForbidsBannerTake,
    reasonPersistentForbidsRelicTake,
    persistentRefusesBannerTake,
    persistentRefusesRelicTake,
    persistentRefusesSecretCost
} from './persistent.js'
import { categoryAt, homelandPayout, homelandPowerFor } from './sitePowers.js'
import { takeRelicsFrom } from './relics.js'
import { isAtLeastOathRevision, OathRevision } from './revision.js'

/** R-5.1.4.IV — "at least two advisers that match the suit of any of their advisers". */
const CONSPIRACY_MATCHES_NEEDED = 2

/** R-5.1.4.IV — how many of the player's faceup advisers match a suit of the target's faceup advisers. */
export function conspiracyMatchCount(
    state: HydratedOathGameState,
    playerId: string,
    targetPlayerId: string
): number {
    const target = state.getPlayerState(targetPlayerId)

    const targetSuits = new Set(
        target
            .faceupAdviserIds()
            .map((cardId) => suitOf(cardId))
            .filter((suit) => suit !== undefined)
    )

    return [...targetSuits].reduce(
        (count, suit) => count + advisersOfSuit(state, playerId, suit),
        0
    )
}

/** R-5.1.4.IV — two faceup advisers whose suits each match one of the target's. */
export function conspiracyMatchIsValid(
    state: HydratedOathGameState,
    playerId: string,
    targetPlayerId: string
): boolean {
    return conspiracyMatchCount(state, playerId, targetPlayerId) >= CONSPIRACY_MATCHES_NEEDED
}

/** A prize the target holds, the card whose persistent power forbids taking it, and its refusal. */
export interface ConspiracyTakeGuard {
    take: ConspiracyTake
    cardId: string
    reason: string
}

/**
 * Why the Conspiracy's take from a player at the site is refused, by cause, in the order
 * `reasonCannotPlayConspiracy` checks: the secret, a power barring secret costs (Spell Breaker),
 * the match, then the prizes (none held, or every one guarded).
 */
export type ConspiracyTakeRefusal =
    | { cause: 'secret'; has: number }
    | { cause: 'secretCost'; cardId: string }
    | { cause: 'match'; needs: number; has: number }
    | { cause: 'nothingHeld' }
    | { cause: 'guarded'; guards: ConspiracyTakeGuard[] }

/** The first cause that refuses every take from a player at the site; none when some take is open. */
export function conspiracyTakeRefusal(
    state: HydratedOathGameState,
    playerId: string,
    targetPlayerId: string
): ConspiracyTakeRefusal | undefined {
    const secrets = state.getPlayerState(playerId).secrets
    // R-7.1.2.a — facedown secrets cannot pay a cost.
    if (secrets < 1) return { cause: 'secret', has: secrets }
    const barred = persistentRefusesSecretCost(state, playerId)
    if (barred) return { cause: 'secretCost', cardId: barred.cardId }
    const matching = conspiracyMatchCount(state, playerId, targetPlayerId)
    if (matching < CONSPIRACY_MATCHES_NEEDED) {
        return { cause: 'match', needs: CONSPIRACY_MATCHES_NEEDED, has: matching }
    }

    const prizes = conspiracyPrizesHeld(state, targetPlayerId)
    if (prizes.length === 0) return { cause: 'nothingHeld' }
    const guards: ConspiracyTakeGuard[] = []
    for (const take of prizes) {
        const guard = conspiracyTakeGuard(state, playerId, targetPlayerId, take)
        if (!guard) return undefined
        guards.push({ take, ...guard })
    }
    return { cause: 'guarded', guards }
}

/** R-5.1.4.IV — "any one relic or banner" the target holds. */
function conspiracyPrizesHeld(
    state: HydratedOathGameState,
    targetPlayerId: string
): ConspiracyTake[] {
    const relics = state
        .getPlayerState(targetPlayerId)
        .relicIds.map((cardId): ConspiracyTake => ({ kind: 'relic', cardId }))
    const banners = Object.values(Banner)
        .filter((banner) => bannerHolder(state, banner) === targetPlayerId)
        .map((banner): ConspiracyTake => ({ kind: 'banner', banner }))
    return [...relics, ...banners]
}

// As `reasonCannotTakeByConspiracy` judges a prize the target holds.
function conspiracyTakeGuard(
    state: HydratedOathGameState,
    playerId: string,
    targetPlayerId: string,
    take: ConspiracyTake
) {
    return take.kind === 'relic'
        ? persistentRefusesRelicTake(state, playerId, targetPlayerId, take.cardId)
        : persistentRefusesBannerTake(state, playerId, take.banner, 'seize', targetPlayerId)
}

export function reasonCannotPlayConspiracy(
    state: HydratedOathGameState,
    playerId: string,
    choice: { keptCardId: string; conspiracy?: ConspiracyPlay }
): string | undefined {
    if (choice.keptCardId !== CONSPIRACY_ID) {
        return `${choice.keptCardId} is not the Conspiracy`
    }
    // R-7.1.4-H1 Vow of Obedience, R-7.1.4 Secret Police — the Conspiracy is a Vision played faceup.
    if (cannotPlayVisionsFaceup(state, playerId)) {
        return 'you cannot play Visions faceup (Vow of Obedience)'
    }
    const faceup = reasonPersistentForbidsFaceupVision(state, playerId, choice.keptCardId)
    if (faceup) return faceup
    const play = choice.conspiracy
    if (!play) {
        return undefined
    }

    const player = state.getPlayerState(playerId)
    const target = state.findPlayerState(play.targetPlayerId)
    if (!target) return 'no such target player'
    if (pawnSiteId(state, target.playerId) !== pawnSiteId(state, playerId)) {
        return 'the target pawn is not at your site'
    }
    if (player.secrets < 1) {
        // R-7.1.2.a — facedown secrets cannot pay a cost.
        return 'taking requires one secret to burn'
    }
    // Spell Breaker — its Q&A names the Conspiracy's burned secret.
    const barred = reasonPersistentForbidsSecretCost(state, playerId)
    if (barred) return barred
    if (!conspiracyMatchIsValid(state, playerId, play.targetPlayerId)) {
        return 'needs two faceup advisers whose suits each match one of theirs'
    }

    return reasonCannotTakeByConspiracy(state, playerId, play.targetPlayerId, play.take)
}

/** The Conspiracy's prize; Circlet of Command, Lost Tongue, Tome Guardians — "cannot target or take … in any way". */
export function reasonCannotTakeByConspiracy(
    state: HydratedOathGameState,
    playerId: string,
    targetPlayerId: string,
    take: ConspiracyTake
): string | undefined {
    if (take.kind === 'relic') {
        if (!state.getPlayerState(targetPlayerId).relicIds.includes(take.cardId)) {
            return `${take.cardId} is not held by that player`
        }
        return reasonPersistentForbidsRelicTake(state, playerId, targetPlayerId, take.cardId)
    }
    if (bannerHolder(state, take.banner) !== targetPlayerId) {
        return `that player does not hold the ${take.banner}`
    }
    return reasonPersistentForbidsBannerTake(state, playerId, take.banner, 'seize', targetPlayerId)
}

/** R-5.1.4 */
export interface CardPlayOptions {
    /** R-7.4 (Crop Rotation) */
    carried?: ActiveModifier[]
    /** R-11.10 (Great Slum) — discarded before the site play. */
    discardFirstCardId?: string
    /** New Growth */
    toSiteId?: string
    reveal?: HiddenReveal
    /** Bracken */
    discardTarget?: DiscardTarget
    /** R-5.1.4.II — advisers may be played either way up. */
    faceUp?: boolean
    /** Truthful Harp, False Prophet — the table saw the card, so a facedown play stays known. */
    seen?: boolean
    /** R-5.1.4.IV — the Conspiracy's optional When Played power. */
    conspiracy?: ConspiracyPlay
    /** R-5.1.4.II, R-7.6.4 — to meet the limit. */
    discardedAdviserCardIds?: readonly string[]
    fromAdvisers?: boolean
    choices?: readonly PowerChoice[]
    /** Land Warden — what the kept card's play did to the map before this second card's. */
    earlierMapChanges?: PlayMapChanges
}

/** R-5.1.4.I the People's Favor, R-11.10 the Great Slum, Crop Rotation — the denizen a site play discards first. */
function cardDiscardedFirst(
    state: HydratedOathGameState,
    play: SearchPlay,
    options: CardPlayOptions
): string | undefined {
    const first = play === SearchPlay.Site ? options.discardFirstCardId : undefined
    const at = first ? siteHolding(state, first) : undefined
    return first && at && state.isMusterableCard(at, first) ? first : undefined
}

/** R-5.1.4.I — the site a site play puts the card at: the pawn's, or the one the People's Favor or New Growth names. */
function sitePlayedTo(
    state: HydratedOathGameState,
    playerId: string,
    options: CardPlayOptions
): string {
    return options.toSiteId ?? pawnSiteId(state, playerId)
}

/** Book of Records — "you must gain a secret instead of favor" from a site play. */
function sitePlayGainsSecret(options: CardPlayOptions): boolean {
    return (options.carried ?? []).some((m) => m.hooks.sitePlayGainsSecret)
}

/**
 * R-5.1.4 — what a play does to the map before its When Played power resolves, read from the state before the
 * play: the check and the resolve both judge the power on the map these leave. With it, the site played to and
 * what the play gains first (R-7.3.3), which only a check adds to the state it reads.
 */
export function playMapChanges(
    state: HydratedOathGameState,
    playerId: string,
    cardId: string,
    play: SearchPlay,
    options: CardPlayOptions = {}
): PlayMapChanges {
    const first = cardDiscardedFirst(state, play, options)
    const earlier = options.earlierMapChanges
    const siteId = play === SearchPlay.Site ? sitePlayedTo(state, playerId, options) : undefined
    return {
        leaving: [...(earlier?.leaving ?? []), ...(first ? [first] : [])],
        arriving: [...(earlier?.arriving ?? []), ...(play === SearchPlay.Site ? [cardId] : [])],
        ...(siteId !== undefined ? { siteId } : {}),
        gains: playGains(state, playerId, cardId, play, siteId, first, options)
    }
}

/**
 * R-7.3.3 — the play's own gains, planned from the steps `playCard` takes and in its order, on the state before
 * the play: the card discarded first gives its tokens back (R-10.5) and writes the Homeland ledger (R-11.2), the
 * site gives its favor (Book of Records: a secret instead), then the Homeland pays. An adviser play gives back the
 * tokens of the advisers it discards. Land Warden's second card starts from the kept card's gains. The relic a
 * Homeland gives is not planned: no check reads it, and its identity is the vault's.
 */
function playGains(
    state: HydratedOathGameState,
    playerId: string,
    cardId: string,
    play: SearchPlay,
    siteId: string | undefined,
    first: string | undefined,
    options: CardPlayOptions
): PlayGains {
    const earlier = options.earlierMapChanges
    const favorBank: Record<Suit, number> = { ...(earlier?.gains?.favorBank ?? state.favorBank) }
    const returning = [...(earlier?.gains?.returning ?? [])]
    let secrets = earlier?.gains?.secrets ?? 0
    const giveBack = (id: string) => {
        returning.push(id)
        const back = tokensReturnedBy(state, id)
        if (back.suit) favorBank[back.suit] += back.favor
    }
    // R-10.10, R-9.3 — as `gainFavorFromBank` takes it; Vow of Kinship keeps it in a bank.
    const homeBank = favorHomeBankOf(state, playerId)
    const favorTaken: FavorTake[] = []
    const gainOneFavor = (suit: Suit) => {
        const gained = favorTakenFrom(favorBank[suit], 1)
        favorBank[suit] -= gained
        if (homeBank) favorBank[homeBank] += gained
        favorTaken.push({ suit, gained })
    }

    if (siteId !== undefined) {
        if (first) giveBack(first)
        const suit = suitOf(cardId)
        if (suit) {
            if (sitePlayGainsSecret(options)) secrets += 1
            else gainOneFavor(suit)
            const discardedFirst = [...(earlier?.leaving ?? []), ...(first ? [first] : [])].flatMap(
                (id) => siteDiscardLedgerKey(state, id) ?? []
            )
            const homeland = homelandPowerFor(state, playerId, siteId, cardId, discardedFirst)
            if (homeland && !homeland.barred) {
                if (homeland.reward === 'favor') gainOneFavor(suit)
                if (homeland.reward === 'secret') secrets += 1
            }
        }
    } else if (play === SearchPlay.Adviser) {
        for (const id of options.discardedAdviserCardIds ?? []) giveBack(id)
    }
    const favorAfter =
        siteId !== undefined && !earlier && kindOf(cardId) === CardKind.Denizen
            ? favorGainedAfterPlay(favorBank, homeBank, options.carried ?? [])
            : 0
    return { secrets, returning, favorBank, favorTaken, favorAfter }
}

/** R-7.4 — Welcoming Party's favor once the play is made, each carried card's bank in turn, from the banks given. */
function favorGainedAfterPlay(
    banks: Readonly<Record<Suit, number>>,
    homeBank: Suit | undefined,
    carried: readonly ActiveModifier[]
): number {
    const favorBank = { ...banks }
    let gained = 0
    for (const suit of carried.flatMap((m) => m.hooks.playFavorFrom ?? [])) {
        const taken = favorTakenFrom(favorBank[suit], 1)
        favorBank[suit] -= taken
        if (homeBank) favorBank[homeBank] += taken
        gained += taken
    }
    return gained
}

/** R-5.1.4.I — what a site play gains you, the banks as they stand. */
export interface SitePlayGain {
    favor: number
    secrets: number
}

/**
 * R-5.1.4.I, R-11.2, R-7.4 — all a site play gains you, from its plan on the banks as they stand: the site's favor
 * (Book of Records: a secret instead), a Homeland's favor or secret, and a carried card's favor once the play is
 * made (Welcoming Party). Not what its When Played power gains. Undefined for a play that goes to no site.
 */
export function sitePlayGain(changes: PlayMapChanges): SitePlayGain | undefined {
    const gains = changes.gains
    if (changes.siteId === undefined || !gains) return undefined
    const taken = gains.favorTaken.reduce((sum, take) => sum + take.gained, 0)
    return { favor: taken + gains.favorAfter, secrets: gains.secrets }
}

/** R-9.3 — a bank that could not give a favor the play took: empty from the start, or run out by the play. */
export type FavorShort = Type.Static<typeof FavorShort>
export const FavorShort = Type.Object({ suit: Type.Enum(Suit), ranOut: Type.Boolean() })

/** R-9.3 — the banks that came up short of the favor the play took (`PlayGains.favorTaken`), each once. */
export function favorShortOf(taken: readonly FavorTake[]): FavorShort[] {
    const suits = [...new Set(taken.filter((take) => take.gained === 0).map((take) => take.suit))]
    return suits.map((suit) => ({
        suit,
        ranOut: taken.some((take) => take.suit === suit && take.gained > 0)
    }))
}

/** R-5.1.4.I */
export interface CardPlayResult {
    favorGained: number
    /** Book of Records */
    secretsGained: number
    /** R-9.3 — each favor the play took before its power, the site's and a Homeland's, as its banks gave it. */
    favorTaken: readonly FavorTake[]
    discarded: string[]
    /** R-7.3.3 */
    whenPlayed?: string
    /** R-7.1.4 (Saddle Makers) */
    triggered?: string[]
    /** R-7.3.3 (Long-Lost Heir, Bewitch) */
    endsActPhase?: boolean
    /** R-11.2 */
    sitePower?: string
    /** R-7.3.3 */
    outcome: PowerOutcome
}

export function playCard(
    state: HydratedOathGameState,
    playerId: string,
    cardId: string,
    play: SearchPlay,
    region: Region,
    options: CardPlayOptions = {}
): CardPlayResult {
    const player = state.getPlayerState(playerId)
    const discarded: string[] = []
    const discard = (id: string) => {
        discardCards(state, playerId, [id], region, options.discardTarget)
        discarded.push(id)
    }
    let favorGained = 0
    let secretsGained = 0
    // R-9.3 — as the banks gave it when this card was played: Land Warden's second card is played after the kept
    // card's power, which its plan cannot know.
    const favorTaken: FavorTake[] = []
    let sitePower: string | undefined
    // Read before the play changes the map, as the check reads it.
    const mapChanges = playMapChanges(state, playerId, cardId, play, options)

    switch (play) {
        case SearchPlay.Site: {
            // R-5.1.4.I — New Growth may name another site.
            const siteId = sitePlayedTo(state, playerId, options)
            // R-5.1.4.I the People's Favor, R-11.10 the Great Slum, Crop Rotation — a denizen discarded first.
            const first = cardDiscardedFirst(state, play, options)
            if (first) {
                noteSiteDiscard(state, playerId, first)
                detachFromPlay(state, first)
                discard(first)
            }
            state.denizensBySite[siteId] = [...state.denizensAt(siteId), cardId]

            const suit = suitOf(cardId)
            assertExists(suit, `${cardId} has no suit`)
            if (sitePlayGainsSecret(options)) {
                // Book of Records — "you must gain a secret instead of favor".
                secretsGained = 1
                player.secrets += secretsGained
            } else {
                // R-9.3 — component-limited; take as much as the bank holds.
                favorGained = gainFavorFromBank(state, playerId, suit, 1)
                favorTaken.push({ suit, gained: favorGained })
            }

            // R-11.2
            sitePower = homelandPayout(state, playerId, siteId, cardId, options.reveal, favorTaken)
            break
        }

        case SearchPlay.Adviser: {
            // R-5.1.4.II, R-7.6.4 — discard first if the limit would be exceeded.
            for (const discardedId of options.discardedAdviserCardIds ?? []) {
                player.removeAdviser(discardedId)
                discard(discardedId)
            }
            player.addAdviser(cardId, options.faceUp === true)
            if (options.seen === true) player.markSeen(cardId)
            settleBoardFavor(state, playerId)
            break
        }

        case SearchPlay.RevealedVision: {
            // R-5.1.4.III — one at a time; the old one is discarded, not returned to the deck.
            if (player.revealedVisionId) {
                const toPile = discardRevealedVision(state, playerId, region, options.discardTarget)
                if (toPile) discarded.push(toPile)
            }
            player.revealedVisionId = cardId
            break
        }

        case SearchPlay.Discard: {
            discard(cardId)
            break
        }

        case SearchPlay.Conspiracy: {
            playConspiracy(state, playerId, cardId, options.conspiracy)
            break
        }
    }

    const faceupPlay = isFaceupPlay(play, options.faceUp)
    // R-7.1.4 — "After another player plays a … card" (Saddle Makers). Faceup only: a facedown card has no suit.
    // A Vision revealed, or the Conspiracy played, is a faceup play too (Book Binders).
    const playedFaceup =
        faceupPlay || play === SearchPlay.RevealedVision || play === SearchPlay.Conspiracy
    const cardPlayedTriggers = () =>
        playedFaceup ? afterCardPlayedPersistent(state, playerId, cardId) : []
    // Saddle Makers' Q&A — it pays once the card is played, before its When Played power.
    const triggeredFirst = isAtLeastOathRevision(state, OathRevision.CardFixes1)
        ? cardPlayedTriggers()
        : undefined

    let whenPlayed: string | undefined
    let endsActPhase = false
    let outcome: PowerOutcome = {}
    if (faceupPlay) {
        const power = powersWithTiming(cardId, PowerTiming.WhenPlayed)[0]
        const effect = power ? effectFor(power) : undefined
        if (power && effect) {
            const context: EffectContext = {
                state,
                playerId,
                power,
                choices: options.choices ?? [],
                reveal: options.reveal,
                mapChanges
            }
            if (context.reveal === undefined && effect.hidden?.(context)) {
                whenPlayed = unresolvedForWantOfReveal(cardId)
            } else {
                const result = effect.resolve(context)
                whenPlayed = result.summary
                endsActPhase = result.endsActPhase === true
                outcome = powerOutcomeOf(result)
            }
        }
    }

    const triggered = triggeredFirst ?? cardPlayedTriggers()
    return {
        favorGained,
        secretsGained,
        favorTaken,
        discarded,
        whenPlayed,
        sitePower,
        triggered: triggered.length > 0 ? triggered : undefined,
        endsActPhase: endsActPhase || undefined,
        outcome
    }
}

export function playConspiracy(
    state: HydratedOathGameState,
    playerId: string,
    cardId: string,
    play?: ConspiracyPlay
) {
    if (play) {
        const player = state.getPlayerState(playerId)
        const target = state.getPlayerState(play.targetPlayerId)

        // "burn one secret" — R-10.4; the shared secret supply is not tracked.
        player.secrets -= 1

        const take = play.take
        if (take.kind === 'relic') {
            takeRelicsFrom(state, target.playerId, playerId, [take.cardId])
        } else {
            // R-10.23 — taking a banner this way is a Seize, so R-2.5.3's penalty fires.
            seizeBanner(state, take.banner, playerId)
        }
    }

    state.boxIds.push(cardId)
}

/** Land Warden — the second card's play draws no hidden card, so a When Played power needing one does not resolve. */
function unresolvedForWantOfReveal(cardId: string): string {
    const card = cardDefinition(cardId)
    assertExists(card, `No card is registered as ${cardId}`)
    return `${card.name}: its When Played power was not resolved, because no hidden card was drawn for it`
}

export function reasonWhenPlayedChoicesInvalid(
    state: HydratedOathGameState,
    playerId: string,
    cardId: string,
    play: SearchPlay,
    options: CardPlayOptions = {}
): string | undefined {
    const faceupPlay = isFaceupPlay(play, options.faceUp)
    const power = powersWithTiming(cardId, PowerTiming.WhenPlayed)[0]
    const effect = faceupPlay && power ? effectFor(power) : undefined
    if (!power || !effect) {
        return (options.choices?.length ?? 0) > 0
            ? `${cardId} takes no choices on this play`
            : undefined
    }
    const bad = reasonChoicesInvalid(state, playerId, power, options.choices)
    if (bad) return bad
    return effect.reasonCannotResolve?.({
        state,
        playerId,
        power,
        choices: options.choices ?? [],
        mapChanges: playMapChanges(state, playerId, cardId, play, options)
    })
}

export function reasonCannotPlayCard(
    state: HydratedOathGameState,
    playerId: string,
    cardId: string,
    play: SearchPlay,
    options: CardPlayOptions = {}
): string | undefined {
    return (
        reasonWhenPlayedChoicesInvalid(state, playerId, cardId, play, options) ??
        reasonCannotPlaceCard(state, playerId, cardId, play, options)
    )
}

/** R-5.1.4 — where the card may go, judged apart from the choices its When Played text asks for. */
/** R-5.1.4.II, R-7.6.4 — how many advisers an adviser play puts above the limit it leaves. */
export function adviserDiscardsNeeded(
    state: HydratedOathGameState,
    playerId: string,
    cardId: string,
    options: Pick<CardPlayOptions, 'faceUp' | 'fromAdvisers'>
): number {
    const withCardId = options.faceUp ? cardId : undefined
    // Pied Piper's Q&A: "it does not prompt a discard when you play it", though it counts once held.
    const played =
        !(options.faceUp && arrivesIgnoringAdviserLimit(state, cardId)) &&
        countsTowardAdviserLimit(state, playerId, cardId, !!options.faceUp, withCardId)
    const held = advisersTowardLimit(state, playerId, withCardId) - (options.fromAdvisers ? 1 : 0)
    // R-7.6.4 — a limiter lowering the limit forces discards even when it does not count itself (Family Wagon).
    return Math.max(0, held + (played ? 1 : 0) - effectiveAdviserLimit(state, playerId, withCardId))
}

/** R-7.2.2 — a faceup locked adviser cannot be discarded; a facedown one has no lock. */
export function adviserDiscardable(
    state: HydratedOathGameState,
    playerId: string,
    adviserId: string
): boolean {
    const adviser = state.getPlayerState(playerId).knownAdviser(adviserId)
    return adviser !== undefined && !(adviser.faceUp && isLockedFor(state, playerId, adviserId))
}

function holdsPeoplesFavor(state: HydratedOathGameState, playerId: string): boolean {
    return bannerHolder(state, Banner.PeoplesFavor) === playerId
}

function sameRegion(state: HydratedOathGameState, a: string, b: string): boolean {
    return state.regionOf(a) === state.regionOf(b)
}

/** R-11.10 the Great Slum, R-5.1.4.I the People's Favor — a card discarded before a site play. */
function reasonDiscardFirstInvalid(
    state: HydratedOathGameState,
    playerId: string,
    here: string,
    destination: string,
    cardId: string,
    carried: readonly ActiveModifier[]
): string | undefined {
    const at = siteHolding(state, cardId)
    const allowed =
        // R-11.10 — the Great Slum, when it is the site played to.
        (at === destination && categoryAt(state, destination) === 'greatSlum') ||
        (at === destination && carried.some((m) => m.hooks.discardFirstAtSitePlay === true)) ||
        (holdsPeoplesFavor(state, playerId) && at !== undefined && sameRegion(state, at, here))
    if (!allowed) {
        return "only the Great Slum, Crop Rotation, or holding the People's Favor, lets a card be discarded first"
    }
    // R-7.2.2 — a locked card cannot be discarded; Ancient Bloodline locks it for its holder's enemies.
    return isLockedFor(state, playerId, cardId)
        ? `${cardId} is locked and cannot be discarded`
        : undefined
}

export function reasonCannotPlaceCard(
    state: HydratedOathGameState,
    playerId: string,
    cardId: string,
    play: SearchPlay,
    options: CardPlayOptions = {}
): string | undefined {
    const player = state.getPlayerState(playerId)
    const here = pawnSiteId(state, playerId)

    const kind = kindOf(cardId)
    const definition = cardDefinition(cardId)

    switch (play) {
        case SearchPlay.Site: {
            // R-5.1.4.III — Visions can never be played to a site.
            if (kind === CardKind.Vision) {
                return 'Visions cannot be played to a site'
            }
            if (definition?.placement === 'adviser') {
                return `${cardId} can only be played to your advisers`
            }
            const target = options.toSiteId ?? here
            // R-5.1.4.I — the People's Favor's holder may play to any site in their region;
            // New Growth to another site when a carried modifier allows it for this card.
            if (target !== here) {
                const byFavor =
                    holdsPeoplesFavor(state, playerId) && sameRegion(state, target, here)
                const allowed =
                    byFavor ||
                    (options.carried ?? []).some((m) =>
                        m.hooks.playAnywhere?.({
                            ...modifierContext(state, playerId, m),
                            particulars: { playedCardId: cardId, playedTo: play }
                        })
                    )
                if (!allowed) return `${cardId} can only be played to your own site`
                if (!state.isSiteFaceup(target)) return `${target} is not a faceup site`
            }
            // Salt the Earth — "cannot play to a site with any locked cards"; and, when played, "ignore this
            // site's capacity": the site it is played to. Before revision 16 (R-X.4), a play to another site was
            // judged as any other card's.
            const saltTheEarth =
                cardId === SALT_THE_EARTH &&
                (target === here || isAtLeastOathRevision(state, OathRevision.EngineFixes12))
            // R-5.1.4.I the People's Favor, R-11.10 the Great Slum, Crop Rotation — every site play's card
            // discarded first; Salt the Earth's own "Discard all other denizens at this site" is none. Before
            // revision 16 (R-X.4), Salt the Earth's play to its player's own site left it unchecked.
            const first = options.discardFirstCardId
            if (
                first !== undefined &&
                (!saltTheEarth || isAtLeastOathRevision(state, OathRevision.EngineFixes12))
            ) {
                const firstReason = reasonDiscardFirstInvalid(
                    state,
                    playerId,
                    here,
                    target,
                    first,
                    options.carried ?? []
                )
                if (firstReason) return firstReason
            }
            if (saltTheEarth) {
                if (state.denizensAt(target).some((id) => isLockedFor(state, playerId, id))) {
                    return 'Salt the Earth cannot be played to a site with any locked cards'
                }
            } else {
                const freed =
                    first !== undefined && state.denizensAt(target).includes(first) ? 1 : 0
                const capacity = effectiveSiteCapacity(state, target)
                if (state.denizensAt(target).length - freed >= capacity) {
                    return `site ${target} is at its capacity of ${capacity}`
                }
            }
            if (!suitOf(cardId)) {
                return `${cardId} has no suit, so no favor bank matches it`
            }
            return undefined
        }

        case SearchPlay.Adviser: {
            if (options.faceUp) {
                if (kind !== CardKind.Denizen) {
                    return 'only denizens can be faceup advisers'
                }
                // R-7.2.1; R-7.2 exempts facedown cards, hence the guard.
                if (definition?.placement === 'site') {
                    return `${cardId} can only be played to a site`
                }
            } else if (kind !== CardKind.Denizen && kind !== CardKind.Vision) {
                return 'only denizens and Visions can be advisers'
            } else {
                // R-7.1.4 — Gossip: enemies of its ruler cannot play facedown advisers.
                const gagged = reasonPersistentForbidsFacedownAdviser(state, playerId)
                if (gagged) return gagged
            }

            const excess = adviserDiscardsNeeded(state, playerId, cardId, options)
            const discards = options.discardedAdviserCardIds ?? []
            if (discards.length < excess) {
                const limit = effectiveAdviserLimit(
                    state,
                    playerId,
                    options.faceUp ? cardId : undefined
                )
                return excess === 1
                    ? `already at the adviser limit of ${limit}; one must be discarded first`
                    : `${excess} advisers must be discarded first to meet the adviser limit of ${limit}`
            }
            if (discards.length > excess) {
                return excess === 0
                    ? 'cannot discard an adviser without being at the limit'
                    : `only ${excess} advisers are discarded to meet the limit`
            }
            if (new Set(discards).size !== discards.length) return 'an adviser is discarded once'
            for (const discardedId of discards) {
                if (!player.knownAdviser(discardedId) || discardedId === cardId) {
                    return `${discardedId} is not one of your other advisers`
                }
                if (!adviserDiscardable(state, playerId, discardedId)) {
                    return `${discardedId} is locked and cannot be discarded`
                }
            }
            return undefined
        }

        case SearchPlay.RevealedVision: {
            if (kind !== CardKind.Vision) {
                return `${cardId} is not a Vision`
            }
            if (cardId === CONSPIRACY_ID) {
                return 'the Conspiracy is not played to the Revealed Vision space (R-5.1.4.IV)'
            }
            if (player.status !== PlayerStatus.Exile) {
                return `a ${player.status} cannot play a Vision faceup`
            }
            // R-7.1.4-H1, R-9.2 — Vow of Obedience's "cannot play Visions faceup".
            if (cannotPlayVisionsFaceup(state, playerId)) {
                return 'you cannot play Visions faceup (Vow of Obedience)'
            }
            // R-7.1.4 — Secret Police, Sacred Ground.
            return reasonPersistentForbidsFaceupVision(state, playerId, cardId)
        }

        case SearchPlay.Discard:
            return undefined

        case SearchPlay.Conspiracy:
            return reasonCannotPlayConspiracy(state, playerId, {
                keptCardId: cardId,
                conspiracy: options.conspiracy
            })
    }
}
