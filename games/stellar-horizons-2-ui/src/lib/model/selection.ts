import type { TechId } from '@tabletop/stellar-horizons-2'

export enum SelectionKind {
    Ship = 'Ship',
    Tech = 'Tech'
}

export type Selection =
    { kind: SelectionKind.Ship; shipId: string } | { kind: SelectionKind.Tech; techId: TechId }

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
