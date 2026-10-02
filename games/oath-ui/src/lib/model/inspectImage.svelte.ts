import { cardPreview, type CardPreview, type CardPreviewOwner } from './cardPreview.svelte.js'

export type InspectImageParams = {
    preview: CardPreview
    /** False while the card shows nothing to enlarge. */
    enabled?: boolean
}

/** Rule 4 — a click or tap on a card on the table enlarges it; it never chooses anything. */
export function inspectImage(node: HTMLElement, params: InspectImageParams) {
    const owner: CardPreviewOwner = {}
    let current = $state(params)

    const enabled = () => current.enabled ?? true
    const source = () => current.preview

    const click = (event: MouseEvent) => {
        if (!enabled()) return
        event.preventDefault()
        event.stopPropagation()
        cardPreview.toggle(owner, source)
    }

    node.addEventListener('click', click)

    return {
        // Reading `current` back here would make the update depend on what it writes.
        update(next: InspectImageParams) {
            current = next
            if (next.enabled === false) cardPreview.release(owner)
        },
        destroy() {
            cardPreview.release(owner)
            node.removeEventListener('click', click)
        }
    }
}
