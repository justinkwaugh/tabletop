import * as Type from 'typebox'
import { assertExists } from '@tabletop/common'
import { SOL_SYSTEM_ID, systemDistance } from '../components/systems.js'
import { TECH_FIELDS, type TechField } from '../components/techFields.js'
import { TECHS } from '../components/techs.js'
import { directiveScore } from './directives.js'
import { escalationScore } from './escalation.js'
import { capabilitiesOf } from './fleet.js'
import type { HydratedStellarHorizonsGameState } from './gameState.js'
import { roundHalfUp } from './turn.js'
import { DECADE } from './turnCycle.js'

// Rulebook 3.0, Campaign end: the categories of the victory point table.
export const UNDEVELOPED_TECH_PENALTY = 5
export const LARGE_BASE_STEP = 5
export const LARGEST_BASE_BONUS = 10
export const INFLUENCE_PER_POINT = 2
export const TECH_POINTS_PER_POINT = 10
export const CASH_PER_POINT = 10
export const PLAYER_COUNT_BONUS: Readonly<Record<number, number>> = {
    3: 5,
    4: 10,
    5: 20,
    6: 30,
    7: 40
}

export type CampaignScore = Type.Static<typeof CampaignScore>
export const CampaignScore = Type.Object({
    techs: Type.Number(),
    settlements: Type.Number(),
    largeBases: Type.Number(),
    largestBase: Type.Number(),
    explorationMarkers: Type.Number(),
    influence: Type.Number(),
    techPoints: Type.Number(),
    cash: Type.Number(),
    cards: Type.Number(),
    escalation: Type.Number(),
    directives: Type.Number(),
    // -15 for each directive short of the faction's goal (rulebook 5.1).
    directiveGoal: Type.Number(),
    playerCount: Type.Number(),
    total: Type.Number()
})

function largestBase(state: HydratedStellarHorizonsGameState, playerId: string): number {
    return Math.max(0, ...state.basesOf(playerId).map((base) => base.settlements))
}

// Every Player who ties for the largest base gets the bonus; the rulebook does not say.
export function campaignScore(
    state: HydratedStellarHorizonsGameState,
    playerId: string
): CampaignScore {
    const player = state.getPlayerState(playerId)
    const bases = state.basesOf(playerId)
    const largest = Math.max(0, ...state.players.map((other) => largestBase(state, other.playerId)))
    const markerTotal = TECH_FIELDS.reduce((total, field) => total + player.markerTotal(field), 0)
    const directives = directiveScore(state, playerId)
    const score = {
        techs: -UNDEVELOPED_TECH_PENALTY * (TECHS.length - player.techs.length),
        settlements: bases.reduce(
            (total, base) =>
                total + (base.settlements * systemDistance(SOL_SYSTEM_ID, base.systemId)) / 2,
            0
        ),
        largeBases: bases.reduce(
            (total, base) => total + Math.floor(base.settlements / LARGE_BASE_STEP),
            0
        ),
        largestBase:
            state.numPlayers > 1 && largest > 0 && largestBase(state, playerId) === largest
                ? LARGEST_BASE_BONUS
                : 0,
        explorationMarkers: player.explorationMarkers,
        influence: Math.floor(player.influence / INFLUENCE_PER_POINT),
        techPoints: Math.floor(markerTotal / TECH_POINTS_PER_POINT),
        cash: Math.floor(player.cash / CASH_PER_POINT),
        cards: player.cardPoints(),
        escalation: escalationScore(player),
        directives: directives.points,
        directiveGoal: -directives.penalty,
        playerCount: PLAYER_COUNT_BONUS[state.numPlayers] ?? 0
    }
    const total = roundHalfUp(Object.values(score).reduce((sum, value) => sum + value, 0))
    return { ...score, total }
}

export function campaignWinners(state: HydratedStellarHorizonsGameState): string[] {
    const totals = state.players.map((player) => ({
        playerId: player.playerId,
        total: campaignScore(state, player.playerId).total
    }))
    const best = Math.max(...totals.map((entry) => entry.total))
    return state
        .initiativeOrder()
        .filter((playerId) => totals.find((entry) => entry.playerId === playerId)?.total === best)
}

export interface GalacticRank {
    min: number
    name: string
}

// The rulebook lists 275-300 and 300+; 300 is read as Emperor.
export const GALACTIC_RANKS: readonly GalacticRank[] = [
    { min: Number.NEGATIVE_INFINITY, name: 'Galactic scum' },
    { min: 50, name: 'Scoundrel' },
    { min: 100, name: 'Recruit' },
    { min: 125, name: 'Lieutenant' },
    { min: 150, name: 'Commander' },
    { min: 175, name: 'Captain' },
    { min: 200, name: 'Admiral' },
    { min: 225, name: 'Grand Admiral' },
    { min: 250, name: 'Viceroy' },
    { min: 275, name: 'Overlord' },
    { min: 300, name: 'Emperor' }
]

export function galacticRank(score: number): string {
    const rank = GALACTIC_RANKS.findLast((candidate) => score >= candidate.min)
    assertExists(rank, 'The lowest rank has no minimum')
    return rank.name
}

export function completedFields(
    state: HydratedStellarHorizonsGameState,
    playerId: string
): TechField[] {
    const player = state.getPlayerState(playerId)
    return TECH_FIELDS.filter((field) =>
        TECHS.filter((tech) => tech.field === field).every((tech) => player.ownsTech(tech.id))
    )
}

// From the end of the end-roll year the campaign ends on a percentile roll at or under 1%,
// rising 1% a turn, plus 1% for each tech type a player has completed.
export function endRollChance(state: HydratedStellarHorizonsGameState): number | undefined {
    const endRollYear = state.scenarioDefinition().campaign?.endRollYear
    if (endRollYear === undefined || state.year < endRollYear) {
        return undefined
    }
    const turns = (state.year - endRollYear) / DECADE + 1
    const completed = state.players.reduce(
        (total, player) => total + completedFields(state, player.playerId).length,
        0
    )
    return turns + completed
}

export type EndRoll = Type.Static<typeof EndRoll>
export const EndRoll = Type.Object({
    chance: Type.Number(),
    roll: Type.Number(),
    ended: Type.Boolean(),
    // Transcend Biology's announced change, by the Player who made it.
    modifier: Type.Optional(Type.Object({ playerId: Type.String(), amount: Type.Number() }))
})

// Transcend Biology lets its owner move the chance by up to 3%, announced before the roll.
export function endRollModifier(
    state: HydratedStellarHorizonsGameState
): { playerId: string; amount: number } | undefined {
    for (const player of state.players) {
        const limit = capabilitiesOf(state, player.playerId).endRollModifier
        const amount = Math.max(-limit, Math.min(limit, player.endRollModifier ?? 0))
        if (limit > 0 && amount !== 0) {
            return { playerId: player.playerId, amount }
        }
    }
    return undefined
}

export function rollForEnd(state: HydratedStellarHorizonsGameState): EndRoll | undefined {
    const printed = endRollChance(state)
    if (printed === undefined) {
        return undefined
    }
    const modifier = endRollModifier(state)
    const chance = Math.max(0, printed + (modifier?.amount ?? 0))
    const roll = state.getProtectedPrng().dieRoll(100)
    return { chance, roll, ended: roll <= chance, ...(modifier ? { modifier } : {}) }
}
