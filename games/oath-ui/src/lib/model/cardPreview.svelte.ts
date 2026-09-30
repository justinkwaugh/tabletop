import type { CardKind } from '@tabletop/oath'

// The preview renders once outside `ScalingWrapper`, in screen pixels.
export type CardPreview = {
    cardId?: string
    faceDown: boolean
    backKind?: CardKind
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

class CardPreviewState {
    private source = $state<CardPreviewSource | null>(null)
    // Touch has no pointer leave, so a preview opened by touch stays until
    // `dismiss`, which the preview layer calls on the next tap and swallows it.
    sticky = $state(false)
    private owner: CardPreviewOwner | null = null

    get current(): CardPreview | null {
        return this.source?.() ?? null
    }

    show(owner: CardPreviewOwner, source: CardPreviewSource): void {
        if (this.sticky) return
        this.owner = owner
        this.source = source
    }

    toggleSticky(owner: CardPreviewOwner, source: CardPreviewSource): void {
        if (this.sticky && this.owner === owner) {
            this.dismiss()
            return
        }
        this.owner = owner
        this.source = source
        this.sticky = true
    }

    dismiss(): void {
        this.owner = null
        this.source = null
        this.sticky = false
    }

    release(owner: CardPreviewOwner): void {
        if (this.owner === owner) this.dismiss()
    }

    // Pointer events arrive out of order between adjacent cards: the next
    // card's enter lands before the previous card's leave.
    hide(owner: CardPreviewOwner): void {
        if (this.sticky) return
        if (this.owner !== owner) return
        this.owner = null
        this.source = null
    }
}

export const cardPreview = new CardPreviewState()
