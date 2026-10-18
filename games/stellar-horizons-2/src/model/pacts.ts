import { assertExists } from '@tabletop/common'
import { AnomalyChallenge, anomalyDefinition } from '../components/anomalies.js'
import { eventDefinition } from '../components/events.js'
import { factionSheet } from '../components/factionSheets.js'
import { MachineState } from '../definition/states.js'
import { anomalyStrength, systemAnomaly, usesAnomalyRewards } from './anomalies.js'
import { activeEvent } from './events.js'
import { hasArrived, isCrippled } from './fleet.js'
import type { HydratedStellarHorizonsGameState } from './gameState.js'
import { hasLapsed, isClosed, standingPacts } from './holds.js'
import {
    PactTargetKind,
    type Pact,
    type PactShare,
    type PactTerms,
    type ShipState
} from './pieces.js'

// Rulebook 1.16: ships of several Players may resolve an anomaly or event together if they
// agree how to split the reward. Players negotiate a pact on the Main Line during the
// exploration span with Common Actions (docs/parallel-spans.md, Common Actions, example): a
// partner proposes terms, another counters or accepts, and once every partner has accepted the
// same terms the pact binds. A pact lives in the Common Scope and names its partners only in
// fields of its own; it holds each partner's pledged ships from their proposal or acceptance.

export function pact(state: HydratedStellarHorizonsGameState, pactId: string): Pact | undefined {
    return state.pacts.find((candidate) => candidate.id === pactId)
}

export interface PactTarget {
    systemId: string
    difficulty: number
    reward: { influence: number; cash: number; markers: number; settlements: number }
}

const NO_REWARD = { influence: 0, cash: 0, markers: 0, settlements: 0 }

// The target as everyone sees it: an unresolved anomaly or an event on the map, its difficulty
// with the partners' faction modifiers, and the reward to split.
export function pactTarget(
    state: HydratedStellarHorizonsGameState,
    terms: PactTerms
): PactTarget | undefined {
    const modifier = terms.partnerIds.reduce((total, playerId) => {
        const faction = state.getPlayerState(playerId).faction
        const abilities =
            faction && state.scenarioDefinition().campaign ? factionSheet(faction).abilities : {}
        const value =
            terms.challenge === AnomalyChallenge.Combat
                ? abilities.combatAnomalyDifficulty
                : abilities.scienceAnomalyDifficulty
        return Math.min(total, value ?? 0)
    }, 0)
    if (terms.targetKind === PactTargetKind.Anomaly) {
        const anomaly = anomalyDefinition(terms.targetId)
        const systemId = state.systems.find(
            (system) => systemAnomaly(state, system.systemId)?.id === anomaly.id
        )?.systemId
        if (systemId === undefined || anomaly.challenge !== terms.challenge) {
            return undefined
        }
        const reward = usesAnomalyRewards(state)
            ? {
                  influence: anomaly.reward.influence ?? 0,
                  cash: anomaly.reward.cash ?? 0,
                  markers: anomaly.reward.markers?.count ?? 0,
                  settlements: anomaly.reward.settlements ?? 0
              }
            : NO_REWARD
        return {
            systemId,
            difficulty: anomaly.difficulty + state.numPlayers + modifier,
            reward
        }
    }
    const active = activeEvent(state, terms.targetId)
    const definition = eventDefinition(terms.targetId)
    const printed =
        terms.challenge === AnomalyChallenge.Science
            ? definition.challenge?.science
            : definition.challenge?.combat
    if (active === undefined || printed === undefined) {
        return undefined
    }
    return {
        systemId: active.systemId,
        difficulty: printed + state.numPlayers + modifier,
        reward: { ...NO_REWARD, influence: definition.influence }
    }
}

// Whether a pledged ship could take part, as everyone can see it: at the target, arrived, not
// crippled, with strength for the challenge.
function couldTakePart(ship: ShipState | undefined, systemId: string, challenge: AnomalyChallenge) {
    return (
        ship !== undefined &&
        ship.systemId === systemId &&
        hasArrived(ship) &&
        !isCrippled(ship) &&
        anomalyStrength(ship, challenge) > 0
    )
}

// A Player guarantees only their own side: their pledged ships are free in their own Branch
// (Common Actions rule 5). A ship already held by another of their standing offers is not free.
export function ownSideFree(
    state: HydratedStellarHorizonsGameState,
    playerId: string,
    terms: PactTerms,
    systemId: string,
    exceptPactId?: string
): boolean {
    const pledged = terms.pledges[playerId] ?? []
    const held = standingPacts(state)
        .filter((candidate) => candidate.id !== exceptPactId)
        .filter((candidate) => candidate.agreed || candidate.acceptedIds.includes(playerId))
        .flatMap((candidate) => candidate.terms.pledges[playerId] ?? [])
    return (
        pledged.length > 0 &&
        pledged.every((shipId) => {
            const ship = state.playerShip(playerId, shipId)
            return (
                ship !== undefined &&
                couldTakePart(ship, systemId, terms.challenge) &&
                !ship.explored &&
                !held.includes(shipId)
            )
        })
    )
}

function sumsMatch(terms: PactTerms, reward: PactTarget['reward']): boolean {
    const keys = Object.keys(terms.shares)
    if (
        keys.length !== terms.partnerIds.length ||
        !terms.partnerIds.every((id) => keys.includes(id))
    ) {
        return false
    }
    const shares = Object.values(terms.shares)
    const total = (field: keyof PactShare) => shares.reduce((sum, share) => sum + share[field], 0)
    const whole = shares.every((share) =>
        Object.values(share).every((value) => Number.isInteger(value) && value >= 0)
    )
    return (
        whole &&
        total('influence') === reward.influence &&
        total('cash') === reward.cash &&
        total('markers') === reward.markers &&
        total('settlements') === reward.settlements
    )
}

function inAgreedPact(state: HydratedStellarHorizonsGameState, playerId: string, terms: PactTerms) {
    return state.pacts.some(
        (candidate) =>
            candidate.agreed &&
            candidate.terms.targetId === terms.targetId &&
            candidate.terms.partnerIds.includes(playerId)
    )
}

// Terms everyone can check: an exploration span in progress, partners of the span who have not
// closed, ships at the target able to take part whose combined strength reaches its
// difficulty, and shares that split the reward exactly. In These are the Voyages the reward is
// ignored and the pact names the partner who keeps the tile.
export function areValidTerms(
    state: HydratedStellarHorizonsGameState,
    proposerId: string,
    terms: PactTerms,
    exceptPactId?: string
): boolean {
    const span = state.parallelSpan
    const target = pactTarget(state, terms)
    if (
        span === undefined ||
        state.machineState !== MachineState.ExplorationPhase ||
        target === undefined
    ) {
        return false
    }
    const partners = terms.partnerIds
    const ships = partners.flatMap((playerId) =>
        (terms.pledges[playerId] ?? []).map((shipId) => state.playerShip(playerId, shipId))
    )
    const strength = ships.reduce(
        (total, ship) => total + (ship ? anomalyStrength(ship, terms.challenge) : 0),
        0
    )
    const keeperValid = usesAnomalyRewards(state)
        ? terms.keeperId === undefined
        : terms.targetKind === PactTargetKind.Event ||
          (terms.keeperId !== undefined && partners.includes(terms.keeperId))
    return (
        partners.length >= 2 &&
        new Set(partners).size === partners.length &&
        partners.includes(proposerId) &&
        partners.every(
            (playerId) =>
                span.playerIds.includes(playerId) &&
                !isClosed(state, playerId) &&
                (terms.pledges[playerId]?.length ?? 0) > 0 &&
                !state.pacts.some(
                    (candidate) =>
                        candidate.id !== exceptPactId &&
                        candidate.agreed &&
                        candidate.terms.targetId === terms.targetId &&
                        candidate.terms.partnerIds.includes(playerId)
                )
        ) &&
        Object.keys(terms.pledges).every((playerId) => partners.includes(playerId)) &&
        ships.every((ship) => couldTakePart(ship, target.systemId, terms.challenge)) &&
        strength >= target.difficulty &&
        sumsMatch(terms, target.reward) &&
        keeperValid &&
        ownSideFree(state, proposerId, terms, target.systemId, exceptPactId)
    )
}

export function isValidProposal(
    state: HydratedStellarHorizonsGameState,
    playerId: string,
    terms: PactTerms,
    pactId?: string
): boolean {
    if (pactId !== undefined) {
        const existing = pact(state, pactId)
        if (
            existing === undefined ||
            existing.agreed ||
            hasLapsed(state, existing) ||
            !existing.terms.partnerIds.includes(playerId) ||
            existing.terms.targetId !== terms.targetId
        ) {
            return false
        }
    }
    return areValidTerms(state, playerId, terms, pactId)
}

// Action fields are copied field by field: a Game Client executes on guarded values.
function copyTerms(terms: PactTerms): PactTerms {
    return {
        ...terms,
        partnerIds: [...terms.partnerIds],
        pledges: Object.fromEntries(
            Object.entries(terms.pledges).map(([playerId, shipIds]) => [playerId, [...shipIds]])
        ),
        shares: Object.fromEntries(
            Object.entries(terms.shares).map(([playerId, share]) => [playerId, { ...share }])
        )
    }
}

export function propose(
    state: HydratedStellarHorizonsGameState,
    playerId: string,
    terms: PactTerms,
    pactId: string,
    existing: boolean
) {
    const target = pactTarget(state, terms)
    assertExists(target, 'A pact needs a target on the map')
    if (existing) {
        const current = pact(state, pactId)
        assertExists(current, `No pact ${pactId}`)
        current.terms = copyTerms(terms)
        current.proposerId = playerId
        current.revision += 1
        current.acceptedIds = [playerId]
        return
    }
    state.pacts.push({
        id: pactId,
        systemId: target.systemId,
        terms: copyTerms(terms),
        proposerId: playerId,
        revision: 0,
        acceptedIds: [playerId],
        agreed: false
    })
}

export function canAccept(
    state: HydratedStellarHorizonsGameState,
    playerId: string,
    pactId: string,
    revision: number
): boolean {
    const candidate = pact(state, pactId)
    return (
        candidate !== undefined &&
        state.machineState === MachineState.ExplorationPhase &&
        !candidate.agreed &&
        !hasLapsed(state, candidate) &&
        candidate.revision === revision &&
        candidate.terms.partnerIds.includes(playerId) &&
        !candidate.acceptedIds.includes(playerId) &&
        !inAgreedPact(state, playerId, candidate.terms) &&
        ownSideFree(state, playerId, candidate.terms, candidate.systemId, pactId)
    )
}

// Returns whether the acceptance completed the agreement.
export function accept(
    state: HydratedStellarHorizonsGameState,
    playerId: string,
    pactId: string
): boolean {
    const candidate = pact(state, pactId)
    assertExists(candidate, `No pact ${pactId}`)
    candidate.acceptedIds.push(playerId)
    candidate.agreed = candidate.terms.partnerIds.every((id) => candidate.acceptedIds.includes(id))
    return candidate.agreed
}

export function canWithdraw(
    state: HydratedStellarHorizonsGameState,
    playerId: string,
    pactId: string
) {
    const candidate = pact(state, pactId)
    return (
        candidate !== undefined &&
        state.machineState === MachineState.ExplorationPhase &&
        !candidate.agreed &&
        candidate.terms.partnerIds.includes(playerId)
    )
}

export function withdraw(state: HydratedStellarHorizonsGameState, pactId: string) {
    state.pacts = state.pacts.filter((candidate) => candidate.id !== pactId)
}

export function pactsNaming(state: HydratedStellarHorizonsGameState, playerId: string): Pact[] {
    return standingPacts(state).filter((candidate) => candidate.terms.partnerIds.includes(playerId))
}

export { hasLapsed, heldShipIds, isHeld, standingPacts } from './holds.js'
