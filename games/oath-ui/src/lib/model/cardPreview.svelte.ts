import type { CardKind } from '@tabletop/oath'

// The preview renders once outside `ScalingWrapper`, in screen pixels.
export type CardPreview = {
    cardId?: string
    back?: CardKind
    label?: string
    slotId?: string
    imageSrc?: string
    aspect?: number
    badge?: { kind: 'favor' | 'secret'; count: number }
}

// An identity token held by the card for its lifetime.
export type CardPreviewOwner = object

/** Reads the owner's current props, so the preview always pictures what its owner now shows. */
export type CardPreviewSource = () => CardPreview

// Rule 4 — a press opens the enlarged card; the next press anywhere, or Escape, closes it.
class CardPreviewState {
    private source = $state<CardPreviewSource | null>(null)
    private owner: CardPreviewOwner | null = null

    get current(): CardPreview | null {
        return this.source?.() ?? null
    }

    get open(): boolean {
        return this.source !== null
    }

    /** A second press on the same card returns, as its magnifier promises. */
    toggle(owner: CardPreviewOwner, source: CardPreviewSource): void {
        if (this.owner === owner && this.source !== null) {
            this.dismiss()
            return
        }
        this.owner = owner
        this.source = source
    }

    dismiss(): void {
        this.owner = null
        this.source = null
    }

    release(owner: CardPreviewOwner): void {
        if (this.owner === owner) this.dismiss()
    }
}

export const cardPreview = new CardPreviewState()
