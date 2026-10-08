import {
    ActionType,
    Banner,
    bannerHolder,
    anyRelaxesOccupancy,
    cannotGainFavorFromTrade,
    HydratedCampaign,
    HydratedMuster,
    HydratedRecover,
    HydratedSearch,
    HydratedTrade,
    HydratedTravel,
    SearchSource,
    TradeOption,
    freeActionTypesNow,
    reasonFreeActionComesFirst,
    usableFavor,
    type HydratedOathGameState
} from '@tabletop/oath'
import type { MajorAction, MajorEntry } from './actionCatalogue.js'

// The engine's own sentence wherever a representative choice exists, else that the list is empty.
export function reasonActionUnavailable(
    gameState: HydratedOathGameState,
    playerId: string,
    type: MajorAction
): string | undefined {
    const player = gameState.getPlayerState(playerId)
    const freeFirst = reasonFreeActionComesFirst(gameState, playerId, type)
    if (freeFirst) return freeFirst

    switch (type) {
        case ActionType.Travel: {
            if (HydratedTravel.legalDestinations(gameState, playerId).length > 0) return undefined
            return player.siteId
                ? 'no destination you can afford — the cheapest Travel is 1 Supply'
                : 'your pawn is not on the map yet'
        }

        case ActionType.Muster: {
            if (HydratedMuster.canDoMuster(gameState, playerId)) return undefined
            const cards = cardsAtSite(gameState, playerId)
            if (cards.length === 0) return 'no card at your site to place favor on'
            return HydratedMuster.reasonCannotMuster(gameState, playerId, cards[0])
        }

        case ActionType.Trade: {
            if (HydratedTrade.canDoTrade(gameState, playerId)) return undefined
            const cards = cardsAtSite(gameState, playerId)
            if (cards.length === 0) return 'no card at your site to trade with'
            // R-5.3.2 — either option alone makes Trade available.
            return (
                HydratedTrade.reasonCannotTrade(
                    gameState,
                    playerId,
                    cards[0],
                    TradeOption.ForFavor
                ) ??
                HydratedTrade.reasonCannotTrade(
                    gameState,
                    playerId,
                    cards[0],
                    TradeOption.ForSecrets
                )
            )
        }

        case ActionType.Search: {
            if (HydratedSearch.canDoSearch(gameState, playerId)) return undefined
            // R-5.1.1 — the discard's flat cost is the more useful sentence.
            return (
                HydratedSearch.reasonCannotSearch(gameState, playerId, SearchSource.Discard) ??
                HydratedSearch.reasonCannotSearch(gameState, playerId, SearchSource.WorldDeck)
            )
        }

        case ActionType.Recover: {
            if (HydratedRecover.canDoRecover(gameState, playerId)) return undefined
            return nothingToRecover(gameState, playerId)
                ? 'nothing at your site to recover, and you hold both banners'
                : 'you cannot pay for anything recoverable here'
        }

        case ActionType.Campaign: {
            if (HydratedCampaign.canDoCampaign(gameState, playerId)) return undefined
            if (!player.siteId) return 'your pawn is not on the map yet'
            // R-5.5.1 — a defender rules or stands on your site; the bandits only when nobody rules it.
            if (HydratedCampaign.legalDefenders(gameState, playerId).length === 0) {
                return 'nobody at your site to attack'
            }
            return `costs ${HydratedCampaign.supplyCostFor(gameState, playerId)} Supply`
        }
    }
}

type PlainCause =
    | 'noCard'
    | 'noEmptyCard'
    | 'nothingToDraw'
    | 'tradeTokens'
    | 'vowOfPoverty'
    | 'nothingToRecover'
    | 'cannotPayRecover'
    | 'nobodyToAttack'

/** Why a dimmed major tile is dimmed, by cause; a cause not named here keeps the engine's sentence. */
export type GridRefusal =
    | { cause: 'freeFirst'; due: ActionType[] }
    | { cause: 'supply'; needs: number; has: number }
    | { cause: 'favor'; has: number }
    | { cause: PlainCause }
    | { cause: 'engine'; reason: string }

export type KnownRefusal = Exclude<GridRefusal, { cause: 'engine' }>

/** What stops one card, pile or destination, for a cause the grid names. */
type CandidateCause =
    'supply' | 'favor' | 'noEmptyCard' | 'nothingToDraw' | 'tradeTokens' | 'vowOfPoverty'

interface Candidate {
    cost: number
    cause: CandidateCause | undefined
}

export function gridRefusal(
    gameState: HydratedOathGameState,
    playerId: string,
    type: MajorAction
): GridRefusal | undefined {
    const reason = reasonActionUnavailable(gameState, playerId, type)
    if (reason === undefined) return undefined
    return knownCause(gameState, playerId, type) ?? { cause: 'engine', reason }
}

function knownCause(
    gameState: HydratedOathGameState,
    playerId: string,
    type: MajorAction
): KnownRefusal | undefined {
    if (reasonFreeActionComesFirst(gameState, playerId, type)) {
        return { cause: 'freeFirst', due: freeActionTypesNow(gameState, playerId) }
    }
    switch (type) {
        case ActionType.Travel:
            return sharedCause(gameState, playerId, travelCandidates(gameState, playerId))

        case ActionType.Muster: {
            const cards = cardsAtSite(gameState, playerId)
            if (cards.length === 0) return { cause: 'noCard' }
            return sharedCause(
                gameState,
                playerId,
                cards.map((cardId) => musterCandidate(gameState, playerId, cardId))
            )
        }

        case ActionType.Trade: {
            const cards = cardsAtSite(gameState, playerId)
            if (cards.length === 0) return { cause: 'noCard' }
            return sharedCause(
                gameState,
                playerId,
                cards.map((cardId) => tradeCandidate(gameState, playerId, cardId))
            )
        }

        case ActionType.Search:
            return sharedCause(
                gameState,
                playerId,
                Object.values(SearchSource).map((source) =>
                    searchCandidate(gameState, playerId, source)
                )
            )

        case ActionType.Recover:
            return {
                cause: nothingToRecover(gameState, playerId)
                    ? 'nothingToRecover'
                    : 'cannotPayRecover'
            }

        case ActionType.Campaign: {
            const needs = HydratedCampaign.supplyCostFor(gameState, playerId)
            const has = gameState.getPlayerState(playerId).supply
            if (has < needs) return { cause: 'supply', needs, has }
            if (HydratedCampaign.legalDefenders(gameState, playerId).length === 0) {
                return { cause: 'nobodyToAttack' }
            }
            return undefined
        }
    }
}

/** Short words only when every candidate fails for the same cause; mixed causes keep the engine's sentence. */
function sharedCause(
    gameState: HydratedOathGameState,
    playerId: string,
    candidates: readonly Candidate[]
): KnownRefusal | undefined {
    const cause = candidates[0]?.cause
    if (cause === undefined || candidates.some((candidate) => candidate.cause !== cause)) {
        return undefined
    }
    switch (cause) {
        case 'supply':
            return {
                cause,
                needs: Math.min(...candidates.map((candidate) => candidate.cost)),
                has: gameState.getPlayerState(playerId).supply
            }
        case 'favor':
            return { cause, has: usableFavor(gameState, playerId) }
        default:
            return { cause }
    }
}

function travelCandidates(gameState: HydratedOathGameState, playerId: string): Candidate[] {
    const player = gameState.getPlayerState(playerId)
    return gameState
        .allSiteIds()
        .filter((siteId) => siteId !== player.siteId)
        .map((siteId): Candidate => {
            const cost = HydratedTravel.plan(gameState, playerId, siteId).cost
            return { cost, cause: player.supply < cost ? 'supply' : undefined }
        })
}

function musterCandidate(
    gameState: HydratedOathGameState,
    playerId: string,
    cardId: string
): Candidate {
    const plan = HydratedMuster.plan(gameState, playerId, cardId)
    const candidate = (cause: CandidateCause | undefined) => ({ cost: plan.cost, cause })
    if (gameState.getPlayerState(playerId).supply < plan.cost) return candidate('supply')
    // Initiation Rite places a secret instead; that cause keeps the engine's sentence.
    if (!HydratedMuster.placesSecret(plan.active) && usableFavor(gameState, playerId) < 1) {
        return candidate('favor')
    }
    // R-7.1.2.a — Pressgangs lifts the bar.
    if (holdsTokens(gameState, cardId) && !anyRelaxesOccupancy(gameState, playerId, plan.active)) {
        return candidate('noEmptyCard')
    }
    return candidate(undefined)
}

function tradeCandidate(
    gameState: HydratedOathGameState,
    playerId: string,
    cardId: string
): Candidate {
    const player = gameState.getPlayerState(playerId)
    const cost = Math.min(
        ...[TradeOption.ForFavor, TradeOption.ForSecrets].map(
            (option) => HydratedTrade.plan(gameState, playerId, cardId, option).cost
        )
    )
    const candidate = (cause: CandidateCause | undefined) => ({ cost, cause })
    if (player.supply < cost) return candidate('supply')
    // R-7.1.2.a
    if (holdsTokens(gameState, cardId)) return candidate('noEmptyCard')
    // R-5.3.2 — trading for secrets places two favor, trading for favor a secret.
    if (usableFavor(gameState, playerId) >= 2) return candidate(undefined)
    if (player.secrets < 1) return candidate('tradeTokens')
    // R-7.1.4-H1 — Vow of Poverty.
    if (cannotGainFavorFromTrade(gameState, playerId)) return candidate('vowOfPoverty')
    return candidate(undefined)
}

function searchCandidate(
    gameState: HydratedOathGameState,
    playerId: string,
    source: SearchSource
): Candidate {
    const cost = HydratedSearch.plan(gameState, playerId, source).cost
    if (gameState.getPlayerState(playerId).supply < cost) return { cost, cause: 'supply' }
    const empty =
        source === SearchSource.WorldDeck
            ? gameState.worldDeckExhausted
            : gameState.discardPileCounts[HydratedSearch.drawRegion(gameState, playerId)] === 0
    return { cost, cause: empty ? 'nothingToDraw' : undefined }
}

function holdsTokens(gameState: HydratedOathGameState, cardId: string): boolean {
    const tokens = gameState.tokensOn(cardId)
    return tokens.favor > 0 || tokens.secrets > 0
}

function nothingToRecover(gameState: HydratedOathGameState, playerId: string): boolean {
    const siteId = gameState.getPlayerState(playerId).siteId
    const hasRelic = !!siteId && gameState.relicSlotsAt(siteId).length > 0
    const anyBanner = Object.values(Banner).some(
        (banner) => bannerHolder(gameState, banner) !== playerId
    )
    return !hasRelic && !anyBanner
}

function cardsAtSite(gameState: HydratedOathGameState, playerId: string): string[] {
    const siteId = gameState.getPlayerState(playerId).siteId
    if (!siteId) return []
    return gameState.denizensBySite[siteId] ?? []
}

const PLAIN_WORDS: Record<PlainCause, string> = {
    noCard: 'No card here.',
    noEmptyCard: 'No empty card here.',
    nothingToDraw: 'Nothing to draw.',
    tradeTokens: 'Needs 1 secret or 2 favor.',
    vowOfPoverty: 'Vow of Poverty: no favor from Trade.',
    nothingToRecover: 'Nothing to recover.',
    cannotPayRecover: 'Can’t pay for any of it.',
    nobodyToAttack: 'Nobody here to attack.'
}

/** The line under the grid for a cause it names; the panel draws favor and secrets as tokens. */
export function refusalWords(refusal: KnownRefusal): string {
    switch (refusal.cause) {
        case 'freeFirst':
            return `Free ${freeActionNames(refusal.due)} first.`
        case 'supply':
            return `Needs ${refusal.needs} Supply; you have ${refusal.has}.`
        case 'favor':
            return `Needs 1 favor; you have ${refusal.has}.`
        default:
            return PLAIN_WORDS[refusal.cause]
    }
}

/** R-5.5.1, R-10.2 — a tile's cost as the engine charges it now: none for a due free action. */
export function tileCost(
    gameState: HydratedOathGameState,
    playerId: string,
    entry: MajorEntry
): string {
    const free =
        entry.type === ActionType.Campaign
            ? HydratedCampaign.supplyCostFor(gameState, playerId) === 0
            : entry.type === ActionType.Travel &&
              freeActionTypesNow(gameState, playerId).includes(ActionType.Travel)
    return free ? 'no Supply' : entry.cost
}

function freeActionNames(due: readonly ActionType[]): string {
    return due.map((type) => (type === ActionType.Travel ? 'Travel' : 'Campaign')).join(' or ')
}

/** R-10.2 — the line above the grid while a granted free action must come next. */
export function freeActionDueLine(
    gameState: HydratedOathGameState,
    playerId: string
): string | undefined {
    const due = freeActionTypesNow(gameState, playerId)
    if (due.length === 0) return undefined
    return `Free ${freeActionNames(due)} next.`
}
