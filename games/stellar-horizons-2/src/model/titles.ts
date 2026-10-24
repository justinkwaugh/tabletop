import { cardDefinition } from '../components/cards.js'
import { SOL_SYSTEM_ID } from '../components/systems.js'
import {
    DRAWN_TITLES,
    MIN_OTHER_TITLES,
    TITLES,
    TITLE_POINTS,
    TITLE_SURCHARGE,
    TitleId,
    type TitlePrerequisite,
    TitlePrerequisiteKind,
    expiresWithTheTurn,
    titleDefinition
} from '../components/titles.js'
import { WorldClass } from '../components/worldTypes.js'
import { isCampaign } from './campaign.js'
import type { HydratedStellarHorizonsGameState } from './gameState.js'
import {
    type TitleChange,
    type TitlePurchase,
    type TitleRenunciation,
    TitleRequestKind
} from './pieces.js'
import { isInBranch } from './turnPlan.js'

// Rulebook 5.2: titles bought with influence once their prerequisite is met, each worth 10 points
// and a lasting benefit.

export function usesTitles(state: HydratedStellarHorizonsGameState): boolean {
    return isCampaign(state) && state.optionalRules.titles
}

const FIXED_TITLES = TITLES.filter((title) => title.fixed).map((title) => title.id)

function drawTitle(
    state: HydratedStellarHorizonsGameState,
    random = state.getProtectedPrng()
): TitleId | undefined {
    if (state.titlePool.length === 0) {
        return undefined
    }
    const [titleId] = state.titlePool.splice(random.randInt(state.titlePool.length), 1)
    return titleId
}

// Setup: Admiral, Warlord and Chancellor and three more drawn at random are laid out; the rest
// wait to replace those bought. The layout is face up before anyone sees the game, so it is drawn
// on the public stream; replacements during play are drawn on the protected one. Removing Admiral
// and Warlord in solo and cooperative play is slice 7's.
export function layOutTitles(state: HydratedStellarHorizonsGameState) {
    if (!usesTitles(state)) {
        return
    }
    state.titlePool = TITLES.filter((title) => !title.fixed).map((title) => title.id)
    const random = state.getPublicPrng()
    const drawn = Array.from({ length: DRAWN_TITLES }).flatMap(() => {
        const titleId = drawTitle(state, random)
        return titleId ? [titleId] : []
    })
    state.availableTitles = [...FIXED_TITLES, ...drawn]
}

// The titles a Player owns once their requests in this Branch are settled.
export function titlesHeld(state: HydratedStellarHorizonsGameState, playerId: string): TitleId[] {
    const player = state.getPlayerState(playerId)
    const requested = (kind: TitleRequestKind) =>
        player.titleRequests
            .filter((request) => request.kind === kind)
            .map((request) => request.titleId)
    const renounced = requested(TitleRequestKind.Renounce)
    return [
        ...player.titles.filter((titleId) => !renounced.includes(titleId)),
        ...requested(TitleRequestKind.Buy)
    ]
}

// Warlord's "cannot have any other titles" (rulebook 5.2), owned or waiting in a Branch.
function excludesOtherTitles(titleIds: readonly TitleId[]): boolean {
    return titleIds.some((titleId) => titleDefinition(titleId).effects.excludesOtherTitles)
}

// Rulebook 5.2: the listed cost, +5 for every title already owned.
export function titleCost(
    state: HydratedStellarHorizonsGameState,
    playerId: string,
    titleId: TitleId
): number {
    return titleDefinition(titleId).cost + TITLE_SURCHARGE * titlesHeld(state, playerId).length
}

// "This turn" prerequisites read the turn record; "have" and "own" ones the Player as they are.
export function meetsPrerequisite(
    state: HydratedStellarHorizonsGameState,
    playerId: string,
    prerequisite: TitlePrerequisite
): boolean {
    const player = state.getPlayerState(playerId)
    const record = player.turnRecord
    switch (prerequisite.kind) {
        case TitlePrerequisiteKind.None:
            return true
        case TitlePrerequisiteKind.TerraformedIntoM:
            return record.terraformedClasses.includes(WorldClass.M)
        case TitlePrerequisiteKind.AttackedByMoreEscalation:
            return record.attackedByMoreEscalation
        case TitlePrerequisiteKind.ResolvedChallenge:
            return record.resolvedChallenges.some(
                (resolved) =>
                    resolved.challenge === prerequisite.challenge &&
                    resolved.difficulty >= prerequisite.difficulty
            )
        case TitlePrerequisiteKind.SoldOnEarth:
            return (
                record.sales.filter((sale) => sale.systemId === SOL_SYSTEM_ID).length >=
                prerequisite.count
            )
        case TitlePrerequisiteKind.NarrowMalfunction:
            return (
                record.narrowestMalfunction !== undefined &&
                record.narrowestMalfunction <= prerequisite.within
            )
        case TitlePrerequisiteKind.RolledOne:
            return record.rolledOne.includes(prerequisite.operation)
        case TitlePrerequisiteKind.ExplorationMarkers:
            return player.explorationMarkers >= prerequisite.count
        case TitlePrerequisiteKind.Cards:
            return (
                player.cards.filter(
                    (card) => cardDefinition(card.cardId).deck === prerequisite.deck
                ).length >= prerequisite.count
            )
        case TitlePrerequisiteKind.BaseSettlements:
            return state.basesOf(playerId).some((base) => base.settlements >= prerequisite.count)
        case TitlePrerequisiteKind.EscalationMarkers:
            return player.escalation.length >= prerequisite.count
    }
}

export function canBuyTitle(
    state: HydratedStellarHorizonsGameState,
    playerId: string,
    titleId: TitleId
): boolean {
    const held = titlesHeld(state, playerId)
    return (
        usesTitles(state) &&
        state.availableTitles.includes(titleId) &&
        !held.includes(titleId) &&
        !excludesOtherTitles(held) &&
        meetsPrerequisite(state, playerId, titleDefinition(titleId).prerequisite) &&
        state.getPlayerState(playerId).influence >= titleCost(state, playerId, titleId)
    )
}

export function buyableTitles(
    state: HydratedStellarHorizonsGameState,
    playerId: string
): TitleId[] {
    return state.availableTitles.filter((titleId) => canBuyTitle(state, playerId, titleId))
}

// A title the Player can buy now but not after the turn, its prerequisite being for this turn
// only, keeps the development phase open for them (campaign plan, slice 6b review).
export function canBuyExpiringTitle(
    state: HydratedStellarHorizonsGameState,
    playerId: string
): boolean {
    return buyableTitles(state, playerId).some((titleId) =>
        expiresWithTheTurn(titleDefinition(titleId).prerequisite)
    )
}

export function canRenounceTitle(
    state: HydratedStellarHorizonsGameState,
    playerId: string,
    titleId: TitleId
): boolean {
    return usesTitles(state) && titlesHeld(state, playerId).includes(titleId)
}

// Rulebook 5.2's replacement: a bought title other than the fixed three is replaced from the
// pool.
function replace(state: HydratedStellarHorizonsGameState, titleId: TitleId): TitleId | undefined {
    if (titleDefinition(titleId).fixed) {
        return undefined
    }
    const replacement = drawTitle(state)
    if (replacement) {
        state.availableTitles.push(replacement)
    }
    return replacement
}

// Rulebook 5.2: a renounced title goes back to the pool, but the fixed three, or any title while
// fewer than three others are laid out, is laid out again.
function giveUp(state: HydratedStellarHorizonsGameState, playerId: string, titleId: TitleId) {
    const player = state.getPlayerState(playerId)
    player.titles = player.titles.filter((owned) => owned !== titleId)
    const others = state.availableTitles.filter((available) => !FIXED_TITLES.includes(available))
    if (titleDefinition(titleId).fixed || others.length < MIN_OTHER_TITLES) {
        state.availableTitles.push(titleId)
    } else {
        state.titlePool.push(titleId)
    }
}

// Paid for already, on the Main Line or when the request was queued; Warlord's owner may have no
// other title (rulebook 5.2).
function grant(
    state: HydratedStellarHorizonsGameState,
    playerId: string,
    titleId: TitleId,
    influence: number
): TitlePurchase {
    const player = state.getPlayerState(playerId)
    state.availableTitles = state.availableTitles.filter((available) => available !== titleId)
    const renounced = excludesOtherTitles([titleId]) ? [...player.titles] : []
    for (const owned of renounced) {
        giveUp(state, playerId, owned)
    }
    player.titles.push(titleId)
    const replacement = replace(state, titleId)
    return {
        playerId,
        kind: TitleRequestKind.Buy,
        titleId,
        influence,
        failed: false,
        renounced,
        ...(replacement ? { replacement } : {})
    }
}

function renunciation(playerId: string, titleId: TitleId): TitleRenunciation {
    return { playerId, kind: TitleRequestKind.Renounce, titleId }
}

// On the Main Line a title is bought at once; in a Branch the purchase waits, its IP held, until
// the span ends (campaign plan, slice 6, Q10).
export function buyTitle(
    state: HydratedStellarHorizonsGameState,
    playerId: string,
    titleId: TitleId
): TitlePurchase | undefined {
    const player = state.getPlayerState(playerId)
    const influence = titleCost(state, playerId, titleId)
    player.influence -= influence
    if (isInBranch(state)) {
        player.titleRequests.push({ kind: TitleRequestKind.Buy, titleId, influence })
        return undefined
    }
    return grant(state, playerId, titleId, influence)
}

// Renouncing a purchase still waiting in the Branch takes it back with its IP, as it was never
// made.
export function renounceTitle(
    state: HydratedStellarHorizonsGameState,
    playerId: string,
    titleId: TitleId
): TitleRenunciation | undefined {
    const player = state.getPlayerState(playerId)
    const queued = player.titleRequests.find(
        (request) => request.kind === TitleRequestKind.Buy && request.titleId === titleId
    )
    if (queued) {
        player.titleRequests = player.titleRequests.filter((request) => request !== queued)
        player.influence += queued.influence
        return undefined
    }
    if (isInBranch(state)) {
        player.titleRequests.push({ kind: TitleRequestKind.Renounce, titleId, influence: 0 })
        return undefined
    }
    giveUp(state, playerId, titleId)
    return renunciation(playerId, titleId)
}

// Rulebook 5.2: "if several players qualify, priority goes by initiative". After a span the
// requests are settled in initiative order; a purchase whose title an earlier Player took fails
// and its IP comes back. A title Warlord has already renounced is not renounced again.
export function settleTitleRequests(state: HydratedStellarHorizonsGameState): TitleChange[] {
    return state.initiativeOrder().flatMap((playerId) => {
        const player = state.getPlayerState(playerId)
        const requests = player.titleRequests
        player.titleRequests = []
        return requests.flatMap((request): TitleChange[] => {
            if (request.kind === TitleRequestKind.Renounce) {
                if (!player.titles.includes(request.titleId)) {
                    return []
                }
                giveUp(state, playerId, request.titleId)
                return [renunciation(playerId, request.titleId)]
            }
            if (!state.availableTitles.includes(request.titleId)) {
                player.influence += request.influence
                return [
                    {
                        playerId,
                        kind: TitleRequestKind.Buy,
                        titleId: request.titleId,
                        influence: request.influence,
                        failed: true,
                        renounced: []
                    }
                ]
            }
            return [grant(state, playerId, request.titleId, request.influence)]
        })
    })
}

export function titleScore(state: HydratedStellarHorizonsGameState, playerId: string): number {
    return usesTitles(state) ? TITLE_POINTS * state.getPlayerState(playerId).titles.length : 0
}
