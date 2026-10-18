import type {
    AnomalyChallenge,
    GoodsHolder,
    PactOpening,
    PactShare,
    TechId,
    TradeGood
} from '@tabletop/stellar-horizons-2'

export enum SelectionKind {
    Ship = 'Ship',
    Tech = 'Tech',
    Anomaly = 'Anomaly',
    Event = 'Event',
    Pact = 'Pact',
    RewardSettlements = 'RewardSettlements',
    AssignGoods = 'AssignGoods',
    RewardGoods = 'RewardGoods',
    Sale = 'Sale'
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

// Where each drawn good goes, in the order drawn: a base's system, Earth, or discarded for $1B.
export const EARTH = 'Earth'
export const DISCARD = 'Discard'
export type GoodsDestination = string

export interface AssignmentDraft {
    destinations: GoodsDestination[]
}

// One entry per reward good placed so far, in the order chosen.
export interface RewardGoodsDraft {
    holders: GoodsHolder[]
}

// A sale being set up: how many of the good to sell in the system, and whom to pay.
export interface SaleDraft {
    systemId: string
    good: TradeGood
    count: number
    payeeId?: string
}

export type Selection =
    | { kind: SelectionKind.Ship; shipId: string }
    | { kind: SelectionKind.Tech; techId: TechId }
    | ({ kind: SelectionKind.Anomaly } & AnomalyDraft)
    | ({ kind: SelectionKind.Event } & EventDraft)
    | ({ kind: SelectionKind.Pact } & PactDraft)
    | ({ kind: SelectionKind.RewardSettlements } & RewardDraft)
    | ({ kind: SelectionKind.AssignGoods } & AssignmentDraft)
    | ({ kind: SelectionKind.RewardGoods } & RewardGoodsDraft)
    | ({ kind: SelectionKind.Sale } & SaleDraft)

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

export function selectedAssignmentDraft(
    selection: Selection | undefined
): AssignmentDraft | undefined {
    return selection?.kind === SelectionKind.AssignGoods
        ? { destinations: selection.destinations }
        : undefined
}

export function assignmentSelection(draft: AssignmentDraft): Selection | undefined {
    return draft.destinations.length > 0 ? { kind: SelectionKind.AssignGoods, ...draft } : undefined
}

export function selectedRewardGoodsDraft(
    selection: Selection | undefined
): RewardGoodsDraft | undefined {
    return selection?.kind === SelectionKind.RewardGoods
        ? { holders: selection.holders }
        : undefined
}

export function rewardGoodsSelection(draft: RewardGoodsDraft): Selection | undefined {
    return draft.holders.length > 0 ? { kind: SelectionKind.RewardGoods, ...draft } : undefined
}

export function selectedSaleDraft(selection: Selection | undefined): SaleDraft | undefined {
    return selection?.kind === SelectionKind.Sale
        ? {
              systemId: selection.systemId,
              good: selection.good,
              count: selection.count,
              payeeId: selection.payeeId
          }
        : undefined
}

export function saleSelection(draft: SaleDraft): Selection {
    return { kind: SelectionKind.Sale, ...draft }
}

// Undo takes back one placement at a time, of reward settlements, drawn goods or reward goods;
// any other choice goes whole.
export function popSelection(selection: Selection | undefined): Selection | undefined {
    switch (selection?.kind) {
        case SelectionKind.RewardSettlements:
            return rewardSelection({ systemIds: selection.systemIds.slice(0, -1) })
        case SelectionKind.AssignGoods:
            return assignmentSelection({ destinations: selection.destinations.slice(0, -1) })
        case SelectionKind.RewardGoods:
            return rewardGoodsSelection({ holders: selection.holders.slice(0, -1) })
        default:
            return undefined
    }
}
