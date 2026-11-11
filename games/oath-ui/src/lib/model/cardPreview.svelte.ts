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

/**
 * Reads the owner's current props, so the preview always pictures what its owner now shows; null
 * once the card is gone.
 */
export type CardPreviewSource = () => CardPreview | null

/** One card of a group the enlarged card pages through, named as the table names it. */
export type PreviewGroupCard = { cardId: string; label: string }

/** Reads the group as the table now shows it: the drawn cards, the map's denizens, or one seat's cards. */
export type PreviewGroup = () => readonly PreviewGroupCard[]

export type PreviewSides = { previous?: PreviewGroupCard; next?: PreviewGroupCard }

// Rule 4 — a press opens the enlarged card; the next press anywhere but a side card, or Escape,
// closes it. A card of a group pages to the previous or next card of that group, stopping at the ends.
class CardPreviewState {
    private source = $state<CardPreviewSource | null>(null)
    private group = $state<PreviewGroup | null>(null)
    private owner: CardPreviewOwner | null = null

    get current(): CardPreview | null {
        return this.source?.() ?? null
    }

    get open(): boolean {
        return this.current !== null
    }

    /** The cards either side of the enlarged one in its group; undefined when it pages nowhere. */
    get sides(): PreviewSides | undefined {
        const current = this.current
        if (!current?.cardId || current.back !== undefined || !this.group) return undefined
        const cards = this.group()
        if (cards.length < 2) return undefined
        const index = cards.findIndex((card) => card.cardId === current.cardId)
        if (index < 0) return undefined
        return { previous: cards[index - 1], next: cards[index + 1] }
    }

    toggle(owner: CardPreviewOwner, source: CardPreviewSource, group?: PreviewGroup): void {
        if (this.owner === owner && this.source !== null) {
            this.dismiss()
            return
        }
        this.owner = owner
        this.source = source
        this.group = group ?? null
    }

    /**
     * Shows the previous (-1) or next (1) card of the group; false at an end. No card on the table
     * owns the card paged to, and it closes once it leaves the group.
     */
    page(step: -1 | 1): boolean {
        const group = this.group
        const sides = this.sides
        const target = step < 0 ? sides?.previous : sides?.next
        if (!group || !target) return false
        this.owner = {}
        this.source = () => group().find((card) => card.cardId === target.cardId) ?? null
        return true
    }

    dismiss(): void {
        this.owner = null
        this.source = null
        this.group = null
    }

    release(owner: CardPreviewOwner): void {
        if (this.owner === owner) this.dismiss()
    }
}

export const cardPreview = new CardPreviewState()
