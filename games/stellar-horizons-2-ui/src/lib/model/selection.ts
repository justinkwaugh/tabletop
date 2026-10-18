import type { AnomalyChallenge, PactOpening, PactShare, TechId } from '@tabletop/stellar-horizons-2'

export enum SelectionKind {
    Ship = 'Ship',
    Tech = 'Tech',
    Anomaly = 'Anomaly',
    Event = 'Event',
    Pact = 'Pact',
    RewardSettlements = 'RewardSettlements'
}

export interface AnomalyDraft {
    systemId: string
    shipIds: string[]
}

export interface EventDraft {
    eventId: string
    challenge: AnomalyChallenge
    shipIds: string[]
}

// Terms being drafted for a new pact, or for a counter to the pact named.
export interface PactDraft {
    opening: PactOpening
    counteredPactId?: string
    partnerIds: string[]
    pledges: Record<string, string[]>
    shares?: Record<string, PactShare>
    keeperId?: string
}

// One entry per settlement placed so far, in the order chosen.
export interface RewardDraft {
    systemIds: string[]
}

export type Selection =
    | { kind: SelectionKind.Ship; shipId: string }
    | { kind: SelectionKind.Tech; techId: TechId }
    | ({ kind: SelectionKind.Anomaly } & AnomalyDraft)
    | ({ kind: SelectionKind.Event } & EventDraft)
    | ({ kind: SelectionKind.Pact } & PactDraft)
    | ({ kind: SelectionKind.RewardSettlements } & RewardDraft)

export function shipSelection(shipId: string): Selection {
    return { kind: SelectionKind.Ship, shipId }
}

export function techSelection(techId: TechId): Selection {
    return { kind: SelectionKind.Tech, techId }
}

export function selectedShipId(selection: Selection | undefined): string | undefined {
    return selection?.kind === SelectionKind.Ship ? selection.shipId : undefined
}

export function selectedTechId(selection: Selection | undefined): TechId | undefined {
    return selection?.kind === SelectionKind.Tech ? selection.techId : undefined
}

export function anomalySelection(draft: AnomalyDraft): Selection {
    return { kind: SelectionKind.Anomaly, ...draft }
}

export function selectedAnomalyDraft(selection: Selection | undefined): AnomalyDraft | undefined {
    return selection?.kind === SelectionKind.Anomaly
        ? { systemId: selection.systemId, shipIds: selection.shipIds }
        : undefined
}

// Choosing a ship for an anomaly adds it to the draft for that system, or takes it out again;
// a ship at another anomaly starts a new draft.
export function toggleAnomalyShip(
    draft: AnomalyDraft | undefined,
    systemId: string,
    shipId: string
): AnomalyDraft | undefined {
    const chosen = draft?.systemId === systemId ? draft.shipIds : []
    const shipIds = chosen.includes(shipId)
        ? chosen.filter((candidate) => candidate !== shipId)
        : [...chosen, shipId]
    return shipIds.length > 0 ? { systemId, shipIds } : undefined
}

export function selectedEventDraft(selection: Selection | undefined): EventDraft | undefined {
    return selection?.kind === SelectionKind.Event
        ? {
              eventId: selection.eventId,
              challenge: selection.challenge,
              shipIds: selection.shipIds
          }
        : undefined
}

export function eventSelection(draft: EventDraft): Selection {
    return { kind: SelectionKind.Event, ...draft }
}

export function toggleEventShip(
    draft: EventDraft | undefined,
    eventId: string,
    challenge: AnomalyChallenge,
    shipId: string
): EventDraft | undefined {
    const chosen = draft?.eventId === eventId && draft.challenge === challenge ? draft.shipIds : []
    const shipIds = chosen.includes(shipId)
        ? chosen.filter((candidate) => candidate !== shipId)
        : [...chosen, shipId]
    return shipIds.length > 0 ? { eventId, challenge, shipIds } : undefined
}

export function selectedPactDraft(selection: Selection | undefined): PactDraft | undefined {
    return selection?.kind === SelectionKind.Pact
        ? {
              opening: selection.opening,
              counteredPactId: selection.counteredPactId,
              partnerIds: selection.partnerIds,
              pledges: selection.pledges,
              shares: selection.shares,
              keeperId: selection.keeperId
          }
        : undefined
}

export function pactSelection(draft: PactDraft): Selection {
    return { kind: SelectionKind.Pact, ...draft }
}

export function selectedRewardDraft(selection: Selection | undefined): RewardDraft | undefined {
    return selection?.kind === SelectionKind.RewardSettlements
        ? { systemIds: selection.systemIds }
        : undefined
}

export function rewardSelection(draft: RewardDraft): Selection | undefined {
    return draft.systemIds.length > 0
        ? { kind: SelectionKind.RewardSettlements, ...draft }
        : undefined
}

// Undo takes back one settlement placement at a time; any other choice goes whole.
export function popSelection(selection: Selection | undefined): Selection | undefined {
    return selection?.kind === SelectionKind.RewardSettlements
        ? rewardSelection({ systemIds: selection.systemIds.slice(0, -1) })
        : undefined
}
