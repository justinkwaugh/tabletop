import type { SpaceId } from '@tabletop/promontory-point'

export enum PreviewKind {
    TownTile = 'TownTile'
}

export type PreviewTarget = { kind: PreviewKind.TownTile; spaceId: SpaceId }

// Contract, "Card preview": a press on a town tile enlarges it until the next press or Escape.
export class CardPreview {
    shown: PreviewTarget | undefined = $state()

    show(target: PreviewTarget) {
        this.shown = target
    }

    close() {
        this.shown = undefined
    }
}
