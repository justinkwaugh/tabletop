import { cardPreview, type CardPreview, type CardPreviewOwner } from './cardPreview.svelte.js'

export type InspectImageParams = {
    preview: CardPreview
    /** False while the card shows nothing to enlarge, such as a facedown front (R-9.4). */
    enabled?: boolean
    /** A tap is the card's pick, so touch opens the preview on a hold instead; by default, inside a button. */
    pickable?: boolean
    /** A keyboard path: focus opens the preview a hover does. */
    focus?: boolean
}

const HOLD_TO_INSPECT_MS = 350

/** Hover or focus previews a card; on touch a hold on a pickable card, or a tap on an inert one, keeps it open. */
export function inspectImage(node: HTMLElement, params: InspectImageParams) {
    const owner: CardPreviewOwner = {}
    let current = $state(params)
    let holdTimer: ReturnType<typeof setTimeout> | undefined
    let held = false

    const enabled = () => current.enabled ?? true
    const pickable = () => current.pickable ?? node.closest('button') !== null
    const source = () => current.preview

    const cancel = () => {
        clearTimeout(holdTimer)
        holdTimer = undefined
    }
    const enter = (event: PointerEvent) => {
        if (event.pointerType === 'mouse' && enabled()) cardPreview.show(owner, source)
    }
    const leave = (event: PointerEvent) => {
        if (event.pointerType === 'mouse') cardPreview.hide(owner)
    }
    const down = (event: PointerEvent) => {
        if (event.pointerType === 'mouse' || !enabled() || !pickable()) return
        held = false
        holdTimer = setTimeout(() => {
            held = true
            cardPreview.toggleSticky(owner, source)
        }, HOLD_TO_INSPECT_MS)
    }
    const up = (event: PointerEvent) => {
        cancel()
        if (event.pointerType === 'mouse' || !enabled()) return
        if (!pickable() && !held) cardPreview.toggleSticky(owner, source)
    }
    // The click that ends a hold is the preview's, not the card's pick.
    const click = (event: MouseEvent) => {
        if (!held) return
        held = false
        event.preventDefault()
        event.stopPropagation()
    }
    const focusIn = () => {
        if (current.focus && enabled()) cardPreview.show(owner, source)
    }
    const focusOut = () => {
        if (current.focus) cardPreview.hide(owner)
    }

    node.addEventListener('pointerenter', enter)
    node.addEventListener('pointerleave', leave)
    node.addEventListener('pointerdown', down)
    node.addEventListener('pointerup', up)
    node.addEventListener('pointercancel', cancel)
    node.addEventListener('click', click, { capture: true })
    node.addEventListener('focusin', focusIn)
    node.addEventListener('focusout', focusOut)

    return {
        // Reading `current` back here would make the update depend on what it writes.
        update(next: InspectImageParams) {
            current = next
            if (next.enabled === false) cardPreview.release(owner)
        },
        destroy() {
            cancel()
            cardPreview.release(owner)
            node.removeEventListener('pointerenter', enter)
            node.removeEventListener('pointerleave', leave)
            node.removeEventListener('pointerdown', down)
            node.removeEventListener('pointerup', up)
            node.removeEventListener('pointercancel', cancel)
            node.removeEventListener('click', click, { capture: true })
            node.removeEventListener('focusin', focusIn)
            node.removeEventListener('focusout', focusOut)
        }
    }
}
