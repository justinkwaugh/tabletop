import { bannerHolder } from './oathkeeper.js'
import { siteHolding } from './access.js'
import { gainFavorFromBank, settleBoardFavor } from './favor.js'
import { Banner, SearchPlay, CardKind, PlayerStatus, Region } from '../model/oathEnums.js'
import { ConspiracyPlay, type ConspiracyTake } from '../model/conspiracy.js'
import { isLockedFor } from './locked.js'
import { assertExists } from '@tabletop/common'
import { HydratedOathGameState } from '../model/gameState.js'
import { HiddenReveal } from '../model/hidden.js'
import { PowerOutcome } from '../model/powerOutcome.js'
import { cardDefinition, CONSPIRACY_ID, kindOf, suitOf } from '../data/cardRegistry.js'
import { effectiveSiteCapacity, SALT_THE_EARTH } from './capacity.js'
import { detachFromPlay, discardCards, noteSiteDiscard, type DiscardTarget } from './discard.js'
import { discardRevealedVision } from './revealedVision.js'
import { seizeBanner } from './seize.js'
import { powersWithTiming, PowerTiming } from '../data/cardPowers.js'
import { effectFor, type EffectContext } from '../powers/registry.js'
import { pawnSiteId } from './pawn.js'
import { isFaceupPlay, powerOutcomeOf } from './powerDoorway.js'
import { PowerChoice, reasonChoicesInvalid } from './powerChoice.js'
import { modifierContext, type ActiveModifier } from './modifiers.js'
import {
    advisersTowardLimit,
    cannotPlayVisionsFaceup,
    countsTowardAdviserLimit,
    effectiveAdviserLimit
} from './continuous.js'
import {
    afterCardPlayedPersistent,
    reasonPersistentForbidsFacedownAdviser,
    reasonPersistentForbidsFaceupVision,
    reasonPersistentForbidsSecretCost,
    reasonPersistentForbidsBannerTake,
    reasonPersistentForbidsRelicTake
} from './persistent.js'
import { categoryAt, homelandPayout } from './sitePowers.js'
import { takeRelicsFrom } from './relics.js'

/** R-5.1.4.IV — two faceup advisers whose suits each match one of the target's. */
export function conspiracyMatchIsValid(
    state: HydratedOathGameState,
    playerId: string,
    targetPlayerId: string
): boolean {
    const player = state.getPlayerState(playerId)
    const target = state.getPlayerState(targetPlayerId)

    const targetSuits = new Set(
        target
            .faceupAdviserIds()
            .map((cardId) => suitOf(cardId))
            .filter((suit) => suit !== undefined)
    )

    const matching = player.faceupAdviserIds().filter((cardId) => {
        const suit = suitOf(cardId)
        return suit !== undefined && targetSuits.has(suit)
    }).length

    return matching >= 2
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
    return reasonPersistentForbidsBannerTake(state, playerId, take.banner, targetPlayerId)
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
}

/** R-5.1.4.I */
export interface CardPlayResult {
    favorGained: number
    /** Book of Records */
    secretsGained: number
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
    let sitePower: string | undefined

    switch (play) {
        case SearchPlay.Site: {
            // R-5.1.4.I — New Growth may name another site.
            const siteId = options.toSiteId ?? pawnSiteId(state, playerId)
            // R-5.1.4.I the People's Favor, R-11.10 the Great Slum, Crop Rotation — a denizen discarded first.
            const first = options.discardFirstCardId
            const firstAt = first === undefined ? undefined : siteHolding(state, first)
            if (first && firstAt && state.isMusterableCard(firstAt, first)) {
                noteSiteDiscard(state, playerId, first)
                detachFromPlay(state, first)
                discard(first)
            }
            state.denizensBySite[siteId] = [...state.denizensAt(siteId), cardId]

            const suit = suitOf(cardId)
            assertExists(suit, `${cardId} has no suit`)
            if ((options.carried ?? []).some((m) => m.hooks.sitePlayGainsSecret)) {
                // Book of Records — "you must gain a secret instead of favor".
                secretsGained = 1
                player.secrets += secretsGained
            } else {
                // R-9.3 — component-limited; take as much as the bank holds.
                favorGained = gainFavorFromBank(state, playerId, suit, 1)
            }

            // R-11.2
            sitePower = homelandPayout(state, playerId, siteId, cardId, options.reveal)
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

    let whenPlayed: string | undefined
    let endsActPhase = false
    let outcome: PowerOutcome = {}
    const faceupPlay = isFaceupPlay(play, options.faceUp)
    if (faceupPlay) {
        const power = powersWithTiming(cardId, PowerTiming.WhenPlayed)[0]
        const effect = power ? effectFor(power) : undefined
        if (power && effect) {
            const context: EffectContext = {
                state,
                playerId,
                power,
                choices: options.choices ?? [],
                reveal: options.reveal
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

    // R-7.1.4 — "After another player plays a … card" (Saddle Makers). Faceup only: a facedown card has no suit.
    // A Vision revealed, or the Conspiracy played, is a faceup play too (Book Binders).
    const playedFaceup =
        faceupPlay || play === SearchPlay.RevealedVision || play === SearchPlay.Conspiracy
    const triggered = playedFaceup ? afterCardPlayedPersistent(state, playerId, cardId) : []
    return {
        favorGained,
        secretsGained,
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
    return effect.reasonCannotResolve?.({ state, playerId, power, choices: options.choices ?? [] })
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
    const played = countsTowardAdviserLimit(state, playerId, cardId, !!options.faceUp, withCardId)
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
            // R-5.1.4.I — the People's Favor's holder may play to any site in their region;
            // New Growth to another site when a carried modifier allows it for this card.
            if (options.toSiteId !== undefined && options.toSiteId !== here) {
                const target = options.toSiteId
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
                const first = options.discardFirstCardId
                if (first !== undefined) {
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
                const freed =
                    first !== undefined && state.denizensAt(target).includes(first) ? 1 : 0
                const capacity = effectiveSiteCapacity(state, target)
                if (state.denizensAt(target).length - freed >= capacity) {
                    return `site ${target} is at its capacity of ${capacity}`
                }
                return suitOf(cardId)
                    ? undefined
                    : `${cardId} has no suit, so no favor bank matches it`
            }
            // Salt the Earth — "cannot play to a site with any locked cards";
            // and, when played, "ignore this site's capacity".
            if (cardId === SALT_THE_EARTH) {
                if (state.denizensAt(here).some((id) => isLockedFor(state, playerId, id))) {
                    return 'Salt the Earth cannot be played to a site with any locked cards'
                }
            } else {
                const first = options.discardFirstCardId
                if (first !== undefined) {
                    const firstReason = reasonDiscardFirstInvalid(
                        state,
                        playerId,
                        here,
                        here,
                        first,
                        options.carried ?? []
                    )
                    if (firstReason) return firstReason
                }
                const capacity = effectiveSiteCapacity(state, here)
                const freed = first !== undefined && state.denizensAt(here).includes(first) ? 1 : 0
                const atSite = state.denizensAt(here).length - freed
                if (atSite >= capacity) {
                    return `site ${here} is at its capacity of ${capacity}`
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
