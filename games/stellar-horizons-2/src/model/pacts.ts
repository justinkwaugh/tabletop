import { assertExists } from '@tabletop/common'
import { AnomalyChallenge, anomalyDefinition } from '../components/anomalies.js'
import { eventChallenges, eventDefinition, printedEventDifficulty } from '../components/events.js'
import { MachineState } from '../definition/states.js'
import {
    anomalyDifficulty,
    anomalyStrength,
    canTakePart,
    challengeDifficulty,
    hasStrengthFor,
    systemAnomaly,
    usesAnomalyRewards
} from './anomalies.js'
import { activeEvent } from './events.js'
import type { HydratedStellarHorizonsGameState } from './gameState.js'
import { hasLapsed, heldShipIds, isClosed, standingPacts } from './holds.js'
import { PactTargetKind, type Pact, type PactShare, type PactTerms } from './pieces.js'

// Rulebook 1.16: ships of several Players may resolve an anomaly or event together if they
// agree how to split the reward. Players negotiate a pact on the Main Line during the
// exploration span with Common Actions (docs/parallel-spans.md, Common Actions, example): a
// partner proposes terms, another counters or accepts, and once every partner has accepted the
// same terms the pact binds. A pact lives in the Common Scope and names its partners only in
// fields of its own; it holds each partner's pledged ships from their proposal or acceptance.

export function pact(state: HydratedStellarHorizonsGameState, pactId: string): Pact | undefined {
    return state.pacts.find((candidate) => candidate.id === pactId)
}

export type PactSubject = Pick<PactTerms, 'targetKind' | 'targetId' | 'challenge'>

export interface PactTarget {
    systemId: string
    difficulty: number
    reward: PactShare
}

export function emptyShare(): PactShare {
    return { influence: 0, cash: 0, markers: 0, settlements: 0, goods: 0, cards: 0 }
}

// The target as everyone sees it: an unresolved anomaly or an event on the map, its difficulty
// with the best faction modifier among the partners, and the reward to split.
export function pactTarget(
    state: HydratedStellarHorizonsGameState,
    subject: PactSubject,
    partnerIds: readonly string[]
): PactTarget | undefined {
    if (subject.targetKind === PactTargetKind.Anomaly) {
        const anomaly = anomalyDefinition(subject.targetId)
        const systemId = state.systems.find(
            (system) => systemAnomaly(state, system.systemId)?.id === anomaly.id
        )?.systemId
        if (systemId === undefined || anomaly.challenge !== subject.challenge) {
            return undefined
        }
        return {
            systemId,
            difficulty: easiestFor(partnerIds, (playerId) =>
                anomalyDifficulty(state, anomaly.id, playerId)
            ),
            reward: usesAnomalyRewards(state)
                ? {
                      influence: anomaly.reward.influence ?? 0,
                      cash: anomaly.reward.cash ?? 0,
                      markers: anomaly.reward.markers?.count ?? 0,
                      settlements: anomaly.reward.settlements ?? 0,
                      goods: anomaly.reward.goods?.count ?? 0,
                      cards: anomaly.reward.card ? 1 : 0
                  }
                : emptyShare()
        }
    }
    const active = activeEvent(state, subject.targetId)
    const printed = printedEventDifficulty(subject.targetId, subject.challenge)
    if (active === undefined || printed === undefined) {
        return undefined
    }
    return {
        systemId: active.systemId,
        difficulty: easiestFor(partnerIds, (playerId) =>
            challengeDifficulty(state, printed, subject.challenge, playerId)
        ),
        reward: { ...emptyShare(), influence: eventDefinition(subject.targetId).influence }
    }
}

function easiestFor(
    partnerIds: readonly string[],
    difficulty: (playerId?: string) => number
): number {
    return Math.min(difficulty(), ...partnerIds.map((playerId) => difficulty(playerId)))
}

export function recordPledgeableShips(state: HydratedStellarHorizonsGameState) {
    state.pledgeableShips = state.allShips().flatMap((ship) => {
        const strength = (challenge: AnomalyChallenge) =>
            hasStrengthFor(state, ship, challenge) ? anomalyStrength(state, ship, challenge) : 0
        const science = strength(AnomalyChallenge.Science)
        const combat = strength(AnomalyChallenge.Combat)
        return !ship.explored && science + combat > 0
            ? [
                  {
                      playerId: ship.playerId,
                      shipId: ship.shipId,
                      systemId: ship.systemId,
                      science,
                      combat
                  }
              ]
            : []
    })
}

// What a pledged ship adds as everyone saw it when the phase began; 0 if it could not take part.
export function pledgedStrength(
    state: HydratedStellarHorizonsGameState,
    playerId: string,
    shipId: string,
    systemId: string,
    challenge: AnomalyChallenge
): number {
    const ship = state.pledgeableShips.find(
        (candidate) =>
            candidate.playerId === playerId &&
            candidate.shipId === shipId &&
            candidate.systemId === systemId
    )
    if (!ship) {
        return 0
    }
    return challenge === AnomalyChallenge.Science ? ship.science : ship.combat
}

export function pledgeableShipIds(
    state: HydratedStellarHorizonsGameState,
    playerId: string,
    systemId: string,
    challenge: AnomalyChallenge
): string[] {
    return state.pledgeableShips
        .filter(
            (ship) =>
                ship.playerId === playerId &&
                pledgedStrength(state, playerId, ship.shipId, systemId, challenge) > 0
        )
        .map((ship) => ship.shipId)
}

// A target as a pact names it, with the system it is in.
export type PactOpening = PactSubject & { systemId: string }

export function pactOpenings(state: HydratedStellarHorizonsGameState): PactOpening[] {
    const anomalies = state.systems.flatMap((system) => {
        const anomaly = systemAnomaly(state, system.systemId)
        return anomaly
            ? [
                  {
                      targetKind: PactTargetKind.Anomaly,
                      targetId: anomaly.id,
                      challenge: anomaly.challenge,
                      systemId: system.systemId
                  }
              ]
            : []
    })
    const events = state.events.flatMap((active) =>
        eventChallenges(active.eventId).map((challenge) => ({
            targetKind: PactTargetKind.Event,
            targetId: active.eventId,
            challenge,
            systemId: active.systemId
        }))
    )
    return [...anomalies, ...events]
}

export interface PledgeOption {
    shipId: string
    strength: number
}

// The ships a Player could pledge at a target: as everyone saw them when the phase began, and
// for the viewer's own, only those still free in their Branch.
export function pledgeOptions(
    state: HydratedStellarHorizonsGameState,
    playerId: string,
    viewerId: string,
    opening: PactOpening,
    exceptPactId?: string
): PledgeOption[] {
    return pledgeableShipIds(state, playerId, opening.systemId, opening.challenge)
        .filter(
            (shipId) =>
                playerId !== viewerId ||
                isFreeToPledge(state, playerId, shipId, opening, exceptPactId)
        )
        .map((shipId) => ({
            shipId,
            strength: pledgedStrength(state, playerId, shipId, opening.systemId, opening.challenge)
        }))
}

// The Players a pact could name besides the Player: still exploring, with ships to pledge.
export function possiblePartners(
    state: HydratedStellarHorizonsGameState,
    playerId: string,
    opening: PactOpening
): string[] {
    const span = state.parallelSpan
    if (span === undefined) {
        return []
    }
    return state
        .initiativeOrder()
        .filter(
            (other) =>
                other !== playerId &&
                span.playerIds.includes(other) &&
                !isClosed(state, other) &&
                pledgeableShipIds(state, other, opening.systemId, opening.challenge).length > 0
        )
}

// Whether the Player's free ships and those other Players still exploring could pledge together
// could reach a target that none of them reaches alone.
export function canJoinAnyPact(state: HydratedStellarHorizonsGameState, playerId: string): boolean {
    return pactOpenings(state).some((opening) => {
        const own = state
            .shipsOf(playerId)
            .filter(
                (ship) =>
                    ship.systemId === opening.systemId &&
                    canTakePart(state, ship, opening.challenge)
            )
            .reduce((total, ship) => total + anomalyStrength(state, ship, opening.challenge), 0)
        const partners = possiblePartners(state, playerId, opening)
        const pledgeable = partners.reduce(
            (total, other) =>
                total + pledgeableStrength(state, other, opening.systemId, opening.challenge),
            0
        )
        const target = pactTarget(state, opening, [playerId, ...partners])
        return (
            target !== undefined &&
            own > 0 &&
            partners.length > 0 &&
            own + pledgeable >= target.difficulty
        )
    })
}

function pledgeableStrength(
    state: HydratedStellarHorizonsGameState,
    playerId: string,
    systemId: string,
    challenge: AnomalyChallenge
): number {
    return pledgeableShipIds(state, playerId, systemId, challenge).reduce(
        (total, shipId) => total + pledgedStrength(state, playerId, shipId, systemId, challenge),
        0
    )
}

// Pacts are made while the Exploration Phase's span is open. A Local Game's Main Line may be
// part-way through a Player's Branch then, which the engine sets aside before a Common Action
// runs, so ask the span rather than the current Machine State.
function inExplorationSpan(state: HydratedStellarHorizonsGameState): boolean {
    return (
        (state.parallelSpan?.machineState ?? state.machineState) === MachineState.ExplorationPhase
    )
}

// A Player guarantees only their own side: their pledged ships are free in their own Branch
// (Common Actions rule 5).
export function ownSideFree(
    state: HydratedStellarHorizonsGameState,
    playerId: string,
    terms: PactTerms,
    systemId: string,
    exceptPactId?: string
): boolean {
    const pledged = terms.pledges[playerId] ?? []
    return (
        pledged.length > 0 &&
        pledged.every((shipId) =>
            isFreeToPledge(state, playerId, shipId, { ...terms, systemId }, exceptPactId)
        )
    )
}

function isFreeToPledge(
    state: HydratedStellarHorizonsGameState,
    playerId: string,
    shipId: string,
    opening: PactOpening,
    exceptPactId?: string
): boolean {
    const ship = state.playerShip(playerId, shipId)
    return (
        ship !== undefined &&
        ship.systemId === opening.systemId &&
        hasStrengthFor(state, ship, opening.challenge) &&
        !ship.explored &&
        !heldShipIds(state, playerId, exceptPactId).includes(shipId)
    )
}

function sumsMatch(terms: PactTerms, reward: PactShare): boolean {
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
        total('settlements') === reward.settlements &&
        total('goods') === reward.goods &&
        total('cards') === reward.cards
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

// What is wrong with terms, as everyone can see, or undefined when nothing is: partners of the
// span who have not closed, ships at the target able to take part whose combined strength
// reaches its difficulty, and shares that split the reward exactly. In These are the Voyages
// the reward is ignored and the pact names the partner who keeps the tile. The proposer's own
// ships must be free in their own Branch.
export function termsProblem(
    state: HydratedStellarHorizonsGameState,
    proposerId: string,
    terms: PactTerms,
    exceptPactId?: string
): string | undefined {
    const span = state.parallelSpan
    const target = pactTarget(state, terms, terms.partnerIds)
    if (span === undefined) {
        return 'Pacts are made while ships explore'
    }
    if (target === undefined) {
        return 'The target is no longer there'
    }
    const partners = terms.partnerIds
    if (partners.length < 2 || new Set(partners).size !== partners.length) {
        return 'Choose at least one partner'
    }
    if (!partners.includes(proposerId)) {
        return 'You must be a partner'
    }
    if (
        partners.some((playerId) => !span.playerIds.includes(playerId) || isClosed(state, playerId))
    ) {
        return 'A partner has finished exploring'
    }
    if (partners.some((playerId) => (terms.pledges[playerId]?.length ?? 0) === 0)) {
        return 'Every partner pledges at least one ship'
    }
    if (Object.keys(terms.pledges).some((playerId) => !partners.includes(playerId))) {
        return 'Only partners pledge ships'
    }
    if (
        partners.some((playerId) =>
            state.pacts.some(
                (candidate) =>
                    candidate.id !== exceptPactId &&
                    candidate.agreed &&
                    candidate.terms.targetId === terms.targetId &&
                    candidate.terms.partnerIds.includes(playerId)
            )
        )
    ) {
        return 'A partner already has an agreed pact for this target'
    }
    const strengths = partners.flatMap((playerId) =>
        (terms.pledges[playerId] ?? []).map((shipId) =>
            pledgedStrength(state, playerId, shipId, target.systemId, terms.challenge)
        )
    )
    if (strengths.some((strength) => strength === 0)) {
        return 'A pledged ship cannot take part'
    }
    const strength = strengths.reduce((total, value) => total + value, 0)
    if (strength < target.difficulty) {
        return `The pledged ships total ${strength} of the ${target.difficulty} needed`
    }
    if (!sumsMatch(terms, target.reward)) {
        return 'The shares must add up to the whole reward'
    }
    const keeperValid = usesAnomalyRewards(state)
        ? terms.keeperId === undefined
        : terms.targetKind === PactTargetKind.Event ||
          (terms.keeperId !== undefined && partners.includes(terms.keeperId))
    if (!keeperValid) {
        return 'Choose who keeps the tile'
    }
    if (!ownSideFree(state, proposerId, terms, target.systemId, exceptPactId)) {
        return 'One of your pledged ships is already in use'
    }
    return undefined
}

export function areValidTerms(
    state: HydratedStellarHorizonsGameState,
    proposerId: string,
    terms: PactTerms,
    exceptPactId?: string
): boolean {
    return (
        inExplorationSpan(state) &&
        termsProblem(state, proposerId, terms, exceptPactId) === undefined
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
    const target = pactTarget(state, terms, terms.partnerIds)
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
        inExplorationSpan(state) &&
        !candidate.agreed &&
        !hasLapsed(state, candidate) &&
        candidate.revision === revision &&
        candidate.terms.partnerIds.includes(playerId) &&
        !candidate.acceptedIds.includes(playerId) &&
        !inAgreedPact(state, playerId, candidate.terms) &&
        ownSideFree(state, playerId, candidate.terms, candidate.systemId, pactId)
    )
}

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
        inExplorationSpan(state) &&
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
