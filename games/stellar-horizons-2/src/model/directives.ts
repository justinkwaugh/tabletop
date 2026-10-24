import * as Type from 'typebox'
import { AnomalyChallenge } from '../components/anomalyCatalog.js'
import {
    DIRECTIVES,
    DIRECTIVE_DRAW,
    DIRECTIVE_INFLUENCE,
    DIRECTIVE_REDRAW_COST,
    DIRECTIVE_SHORTFALL_PENALTY,
    DirectiveAttack,
    type DirectiveCondition,
    type DirectiveGoal,
    DirectiveProduction,
    DirectiveType,
    FIRST_DIRECTIVE_DRAW,
    countsForGoal,
    directiveDefinition
} from '../components/directives.js'
import { factionSheet } from '../components/factionSheets.js'
import type { ScenarioDefinition } from '../components/scenarios.js'
import { TradeGood } from '../components/tradeGoods.js'
import { WorldClass } from '../components/worldTypes.js'
import { gainInfluence, isCampaign } from './campaign.js'
import type { HydratedStellarHorizonsGameState } from './gameState.js'
import {
    type DirectivePile,
    DirectiveStatus,
    type DirectiveTotals,
    FulfilledDirective,
    HeldDirective,
    type RemovedDirective,
    emptyDirectiveTotals
} from './pieces.js'
import type { HydratedStellarHorizonsPlayerState } from './playerState.js'

// Rulebook 5.1: directives are orders from a Player's government, kept secret until fulfilled,
// worth points at the end; each faction must fulfil a number of its types.

export function usesDirectives(state: HydratedStellarHorizonsGameState): boolean {
    return isCampaign(state) && state.optionalRules.directives
}

export function initialDirectivePile(scenario: ScenarioDefinition): DirectivePile {
    const directives = scenario.campaign ? DIRECTIVES.map((directive) => directive.id) : []
    return { directives, remaining: directives.length }
}

type ProjectedHeldDirective = HydratedStellarHorizonsPlayerState['heldDirectives'][number]

// A Player's directives in one state, each named only if the viewer may see it.
export function directivesWith(
    player: HydratedStellarHorizonsPlayerState,
    status: DirectiveStatus
): ProjectedHeldDirective[] {
    return player.heldDirectives.filter((held) => held.status === status)
}

function knownDirectives(
    player: HydratedStellarHorizonsPlayerState,
    status: DirectiveStatus
): HeldDirective[] {
    return directivesWith(player, status).filter(
        (held): held is HeldDirective => held.directiveId !== undefined
    )
}

function dropDirectives(player: HydratedStellarHorizonsPlayerState, status: DirectiveStatus) {
    player.heldDirectives = player.heldDirectives.filter((held) => held.status !== status)
}

export function currentDirectiveId(
    state: HydratedStellarHorizonsGameState,
    playerId: string
): string | undefined {
    return knownDirectives(state.getPlayerState(playerId), DirectiveStatus.Current).at(0)
        ?.directiveId
}

function drawFromPile(state: HydratedStellarHorizonsGameState, count: number): string[] {
    const pile = state.directivePile
    const random = state.getProtectedPrng()
    const drawn: string[] = []
    while (drawn.length < count && pile.directives.length > 0) {
        const [directiveId] = pile.directives.splice(random.randInt(pile.directives.length), 1)
        drawn.push(directiveId)
    }
    pile.remaining = pile.directives.length
    return drawn
}

// Directives not kept go back to the pool, which has no order (campaign plan, slice 6, Q3).
function returnToPile(state: HydratedStellarHorizonsGameState, held: readonly HeldDirective[]) {
    state.directivePile.directives.push(...held.map((entry) => entry.directiveId))
    state.directivePile.remaining = state.directivePile.directives.length
}

function heldAs(playerId: string, status: DirectiveStatus, directiveIds: readonly string[]) {
    return directiveIds.map((directiveId) => ({ playerId, status, directiveId }))
}

// Draws a Player's owed directives: with one drawn it is simply theirs (rulebook 5.1: "if only
// one remains in the pool, just draw it").
function drawOwed(state: HydratedStellarHorizonsGameState, playerId: string): HeldDirective[] {
    const player = state.getPlayerState(playerId)
    const drawn = drawFromPile(state, player.directiveDrawsOwed)
    player.directiveDrawsOwed = 0
    const status = drawn.length === 1 ? DirectiveStatus.Current : DirectiveStatus.Drawn
    const held = heldAs(playerId, status, drawn)
    player.heldDirectives.push(...held)
    return held
}

export type DirectiveDeal = Type.Static<typeof DirectiveDeal>
export const DirectiveDeal = Type.Object({
    // Each Player's draws and the directives they gave up, named only to that Player.
    dealt: Type.Array(HeldDirective),
    returned: Type.Array(HeldDirective)
})

export function oweFirstDirectives(state: HydratedStellarHorizonsGameState) {
    for (const player of state.players) {
        player.directiveDrawsOwed = FIRST_DIRECTIVE_DRAW
    }
}

export function anyDirectiveDeal(state: HydratedStellarHorizonsGameState): boolean {
    return state.players.some((player) => player.directiveDrawsOwed > 0)
}

export function anyDirectiveChoice(state: HydratedStellarHorizonsGameState): boolean {
    return state.players.some((player) => choosesDirective(player))
}

export function choosesDirective(player: HydratedStellarHorizonsPlayerState): boolean {
    return directivesWith(player, DirectiveStatus.Drawn).length > 0
}

function returnDirectivesWith(
    state: HydratedStellarHorizonsGameState,
    status: DirectiveStatus
): HeldDirective[] {
    return state.players.flatMap((player) => {
        const returned = knownDirectives(player, status)
        dropDirectives(player, status)
        returnToPile(state, returned)
        return returned
    })
}

// A Branch may not touch the shared pool, so directives not kept while playing one wait beside
// the Player until the span completes, as discarded goods do.
export function returnDiscardedDirectives(
    state: HydratedStellarHorizonsGameState
): HeldDirective[] {
    return returnDirectivesWith(state, DirectiveStatus.Discarded)
}

// On the Main Line, in initiative order, every Player owed draws takes them; a directive given up
// for a redraw goes back only then, so the redraw cannot draw it again.
export function dealDirectives(state: HydratedStellarHorizonsGameState): DirectiveDeal {
    const dealt = state
        .initiativeOrder()
        .filter((playerId) => state.getPlayerState(playerId).directiveDrawsOwed > 0)
        .flatMap((playerId) => drawOwed(state, playerId))
    const returned = returnDirectivesWith(state, DirectiveStatus.GivenUp)
    return { dealt, returned }
}

// Rulebook 5.1: a survey directive whose system is fully surveyed is removed from the game and
// redrawn, at the start of the next turn's deal (campaign plan, slice 6, Q9).
export function removeUnfulfillableDirectives(
    state: HydratedStellarHorizonsGameState
): RemovedDirective[] {
    return state.players.flatMap((player): RemovedDirective[] => {
        const directiveId = currentDirectiveId(state, player.playerId)
        const condition = directiveId ? directiveDefinition(directiveId).condition : undefined
        if (
            directiveId === undefined ||
            condition?.kind !== DirectiveType.Survey ||
            state.systemState(condition.systemId).explorationMarker > 0
        ) {
            return []
        }
        dropDirectives(player, DirectiveStatus.Current)
        const removed = { playerId: player.playerId, directiveId }
        state.removedDirectives.push(removed)
        return [removed]
    })
}

// The turn's totals start afresh, and so does the once-a-turn redraw. A Player holding no
// directive, having fulfilled theirs or had it removed, draws two (rulebook 5.1).
export function startDirectiveTurn(state: HydratedStellarHorizonsGameState) {
    if (!usesDirectives(state)) {
        return
    }
    for (const player of state.players) {
        player.directiveTotals = emptyDirectiveTotals()
        player.redrewDirective = false
        if (player.heldDirectives.length === 0 && state.directivePile.remaining > 0) {
            player.directiveDrawsOwed = DIRECTIVE_DRAW
        }
    }
}

export function isValidDirectiveChoice(
    state: HydratedStellarHorizonsGameState,
    playerId: string,
    directiveId: string
): boolean {
    return knownDirectives(state.getPlayerState(playerId), DirectiveStatus.Drawn).some(
        (held) => held.directiveId === directiveId
    )
}

export interface DirectiveChoice {
    // The directives not kept, named only to their Player.
    returned: HeldDirective[]
    directives?: FulfilledDirective[]
}

function isInBranch(state: HydratedStellarHorizonsGameState): boolean {
    return state.parallelSpan?.branchPlayerId !== undefined
}

// The Player keeps one of the directives drawn; the rest go back to the pool, or wait beside the
// Player until the span ends when chosen in a Branch. What the Player has done this turn already
// counts toward it.
export function chooseDirective(
    state: HydratedStellarHorizonsGameState,
    playerId: string,
    directiveId: string
): DirectiveChoice {
    const player = state.getPlayerState(playerId)
    const others = knownDirectives(player, DirectiveStatus.Drawn).filter(
        (held) => held.directiveId !== directiveId
    )
    dropDirectives(player, DirectiveStatus.Drawn)
    player.heldDirectives.push({ playerId, status: DirectiveStatus.Current, directiveId })
    if (isInBranch(state)) {
        player.heldDirectives.push(
            ...others.map((held) => ({ ...held, status: DirectiveStatus.Discarded }))
        )
    } else {
        returnToPile(state, others)
    }
    const fulfilled = checkDirective(state, playerId)
    return { returned: others, ...(fulfilled ? { directives: [fulfilled] } : {}) }
}

// Rulebook 5.1: once a turn, 1 IP gives up the directive held for two more to choose from.
export function canRedrawDirective(
    state: HydratedStellarHorizonsGameState,
    playerId: string
): boolean {
    const player = state.getPlayerState(playerId)
    return (
        usesDirectives(state) &&
        !player.redrewDirective &&
        player.influence >= DIRECTIVE_REDRAW_COST &&
        currentDirectiveId(state, playerId) !== undefined &&
        !choosesDirective(player) &&
        state.directivePile.remaining > 0
    )
}

export type DirectiveRedraw = Type.Static<typeof DirectiveRedraw>
export const DirectiveRedraw = Type.Object({
    // Whether the draw waits for the span to end, the Player being in a Branch.
    queued: Type.Boolean(),
    givenUp: HeldDirective,
    drawn: Type.Array(HeldDirective)
})

// On the Main Line the two are drawn at once and then the directive given up goes back; in a
// Branch it waits beside the Player and the draw comes when the span ends (campaign plan, slice
// 6, Q9). Either way the redraw cannot draw it again.
export function redrawDirective(
    state: HydratedStellarHorizonsGameState,
    playerId: string
): DirectiveRedraw {
    const player = state.getPlayerState(playerId)
    const [current] = knownDirectives(player, DirectiveStatus.Current)
    player.influence -= DIRECTIVE_REDRAW_COST
    player.redrewDirective = true
    player.directiveDrawsOwed = DIRECTIVE_DRAW
    dropDirectives(player, DirectiveStatus.Current)
    if (isInBranch(state)) {
        const givenUp = { ...current, status: DirectiveStatus.GivenUp }
        player.heldDirectives.push(givenUp)
        return { queued: true, givenUp, drawn: [] }
    }
    const drawn = drawOwed(state, playerId)
    returnToPile(state, [current])
    return { queued: false, givenUp: current, drawn }
}

// What happened toward a directive, as each rule reports it.
export type DirectiveProgress =
    | { kind: DirectiveType.Anomaly; challenge: AnomalyChallenge; difficulty: number }
    | { kind: DirectiveType.Combat; attack: DirectiveAttack; targetId: string }
    | { kind: DirectiveType.Production; production: DirectiveProduction; amount: number }
    | { kind: DirectiveType.Survey; systemId: string }
    | { kind: DirectiveType.Trade; systemId: string; good: TradeGood }
    | { kind: DirectiveType.Terraform; worldClass: WorldClass }

const PRODUCTION_TOTALS: Record<
    DirectiveProduction,
    'miningCash' | 'researchMarkers' | 'baseProductionCash'
> = {
    [DirectiveProduction.MiningCash]: 'miningCash',
    [DirectiveProduction.ResearchMarkers]: 'researchMarkers',
    [DirectiveProduction.BaseProductionCash]: 'baseProductionCash'
}

// How much of a directive that adds up over the turn the turn has given, against what it needs;
// nothing for the others.
export function directiveTotal(
    totals: DirectiveTotals,
    condition: DirectiveCondition
): { done: number; needed: number } | undefined {
    switch (condition.kind) {
        case DirectiveType.Production:
            return {
                done: totals[PRODUCTION_TOTALS[condition.production]],
                needed: condition.amount
            }
        case DirectiveType.Trade:
            return {
                done: totals.sales.filter(
                    (sale) =>
                        sale.systemId === condition.systemId &&
                        (condition.good === undefined || sale.good === condition.good)
                ).length,
                needed: condition.count
            }
        default:
            return undefined
    }
}

// Rulebook 5.1's combat directives: the Player with the most settlements at bases, other than
// the directive's holder; any of those tied counts.
export function directiveTargets(
    state: HydratedStellarHorizonsGameState,
    holderId: string
): string[] {
    const settlements = state.otherPlayers(holderId).map((player) => ({
        playerId: player.playerId,
        settlements: state
            .basesOf(player.playerId)
            .reduce((total, base) => total + base.settlements, 0)
    }))
    const most = Math.max(0, ...settlements.map((entry) => entry.settlements))
    return settlements
        .filter((entry) => entry.settlements === most && most > 0)
        .map((entry) => entry.playerId)
}

function isMet(
    state: HydratedStellarHorizonsGameState,
    playerId: string,
    condition: DirectiveCondition,
    progress: DirectiveProgress | undefined
): boolean {
    const total = directiveTotal(state.getPlayerState(playerId).directiveTotals, condition)
    if (total) {
        return total.done >= total.needed
    }
    switch (condition.kind) {
        case DirectiveType.Anomaly:
            return (
                progress?.kind === DirectiveType.Anomaly &&
                progress.challenge === condition.challenge &&
                progress.difficulty >= condition.difficulty
            )
        case DirectiveType.Combat:
            return (
                progress?.kind === DirectiveType.Combat &&
                progress.attack === condition.attack &&
                directiveTargets(state, playerId).includes(progress.targetId)
            )
        case DirectiveType.Survey:
            return (
                progress?.kind === DirectiveType.Survey && progress.systemId === condition.systemId
            )
        case DirectiveType.Terraform:
            return (
                progress?.kind === DirectiveType.Terraform &&
                condition.classes.includes(progress.worldClass)
            )
        default:
            return false
    }
}

// Fulfilment is automatic (campaign plan, slice 6, Q4): 1 IP and the directive face up for
// scoring. The next is drawn at the start of the next turn.
function checkDirective(
    state: HydratedStellarHorizonsGameState,
    playerId: string,
    progress?: DirectiveProgress
): FulfilledDirective | undefined {
    const directiveId = currentDirectiveId(state, playerId)
    if (
        directiveId === undefined ||
        !isMet(state, playerId, directiveDefinition(directiveId).condition, progress)
    ) {
        return undefined
    }
    const player = state.getPlayerState(playerId)
    dropDirectives(player, DirectiveStatus.Current)
    const fulfilled = { playerId, directiveId, year: state.year }
    player.fulfilledDirectives.push(fulfilled)
    gainInfluence(state, playerId, DIRECTIVE_INFLUENCE)
    return fulfilled
}

export function recordDirectiveProgress(
    state: HydratedStellarHorizonsGameState,
    playerId: string,
    progress: DirectiveProgress
): FulfilledDirective | undefined {
    if (!usesDirectives(state)) {
        return undefined
    }
    const totals = state.getPlayerState(playerId).directiveTotals
    if (progress.kind === DirectiveType.Production) {
        totals[PRODUCTION_TOTALS[progress.production]] += progress.amount
    }
    if (progress.kind === DirectiveType.Trade) {
        totals.sales.push({ systemId: progress.systemId, good: progress.good })
    }
    return checkDirective(state, playerId, progress)
}

// Several things toward a Player's directive at once, such as the goods of one sale or the bases
// of one blockade: the directive is fulfilled by the first that meets it.
export function recordDirectiveProgresses(
    state: HydratedStellarHorizonsGameState,
    playerId: string,
    progresses: readonly DirectiveProgress[]
): FulfilledDirective[] {
    return progresses.flatMap((progress) => {
        const fulfilled = recordDirectiveProgress(state, playerId, progress)
        return fulfilled ? [fulfilled] : []
    })
}

// Rulebook 5.1's difficulty for an anomaly directive, and Guardian's and Mastermind's 10+:
// printed, plus 1 per Player, less the Starfarers' or Syndicate's reduction when they take part,
// before the resolvers' own cards and ships (campaign plan, slice 6, Q6).
export function ruledDifficulty(
    state: HydratedStellarHorizonsGameState,
    printed: number,
    challenge: AnomalyChallenge,
    resolverIds: readonly string[]
): number {
    const reductions = resolverIds.map((playerId) => {
        const faction = state.getPlayerState(playerId).faction
        const abilities = faction && isCampaign(state) ? factionSheet(faction).abilities : {}
        return challenge === AnomalyChallenge.Science
            ? (abilities.scienceAnomalyDifficulty ?? 0)
            : (abilities.combatAnomalyDifficulty ?? 0)
    })
    return printed + state.numPlayers + Math.min(0, ...reductions)
}

export interface GoalProgress {
    goal: DirectiveGoal
    // Fulfilled directives of the goal's types.
    counted: number
}

export function directiveGoalProgress(
    state: HydratedStellarHorizonsGameState,
    playerId: string
): GoalProgress | undefined {
    const player = state.getPlayerState(playerId)
    if (!player.faction) {
        return undefined
    }
    const goal = factionSheet(player.faction).directiveGoal
    const counted = player.fulfilledDirectives.filter((entry) =>
        countsForGoal(goal, directiveDefinition(entry.directiveId))
    ).length
    return { goal, counted }
}

export type DirectiveScore = Type.Static<typeof DirectiveScore>
export const DirectiveScore = Type.Object({
    points: Type.Number(),
    shortfall: Type.Number(),
    penalty: Type.Number()
})

// The fulfilled directives' points, less 15 for each directive short of the faction's goal.
export function directiveScore(
    state: HydratedStellarHorizonsGameState,
    playerId: string
): DirectiveScore {
    const progress = directiveGoalProgress(state, playerId)
    if (!usesDirectives(state) || !progress) {
        return { points: 0, shortfall: 0, penalty: 0 }
    }
    const shortfall = Math.max(0, progress.goal.count - progress.counted)
    return {
        points: state
            .getPlayerState(playerId)
            .fulfilledDirectives.reduce(
                (total, entry) => total + directiveDefinition(entry.directiveId).points,
                0
            ),
        shortfall,
        penalty: shortfall * DIRECTIVE_SHORTFALL_PENALTY
    }
}
