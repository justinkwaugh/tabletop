import type { TechId } from '@tabletop/stellar-horizons-2'

export enum SelectionKind {
    Ship = 'Ship',
    Tech = 'Tech',
    Anomaly = 'Anomaly'
}

export interface AnomalyDraft {
    systemId: string
    shipIds: string[]
}

export type Selection =
    | { kind: SelectionKind.Ship; shipId: string }
    | { kind: SelectionKind.Tech; techId: TechId }
    | ({ kind: SelectionKind.Anomaly } & AnomalyDraft)

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
