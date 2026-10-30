import type { RailroadId, SpaceId } from '@tabletop/promontory-point'

export enum PreviewKind {
    TownTile = 'TownTile',
    Share = 'Share',
    Bag = 'Bag'
}

export type PreviewTarget =
    | { kind: PreviewKind.TownTile; spaceId: SpaceId }
    // R-1.3: share decks and holdings are face up, so any share face may be enlarged.
    | { kind: PreviewKind.Share; railroadId: RailroadId }
    // R-5: the bag shows how many pieces are left, never which.
    | { kind: PreviewKind.Bag }

// Contract, "Card preview": a press on a share or a town tile enlarges it, and a press on the bag
// shows its count, until the next press or Escape.
export class CardPreview {
    shown: PreviewTarget | undefined = $state()

    show(target: PreviewTarget) {
        this.shown = target
    }

    close() {
        this.shown = undefined
    }
}
