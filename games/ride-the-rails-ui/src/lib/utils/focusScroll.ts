import type { HexId } from '@tabletop/ride-the-rails'
import type { Attachment } from 'svelte/attachments'
import { hexIdOf } from './hexElements.js'

type ScrollPosition = { element: Element; left: number; top: number }

/** The board's own boxes and every box around it, with how far each is scrolled. */
function scrollPositions(node: HTMLElement): ScrollPosition[] {
    const inside = [...node.querySelectorAll('div')]
    const around: Element[] = []
    for (let element = node.parentElement; element; element = element.parentElement) {
        around.push(element)
    }
    return [node, ...inside, ...around].map((element) => ({
        element,
        left: element.scrollLeft,
        top: element.scrollTop
    }))
}

/**
 * Contract, Phone layout: focusing a hex the view does not show must not scroll the page or the
 * board's boxes, which on a phone moves the table sideways towards the side panel. The browser
 * scrolls before it reports the focus, so the scroll positions are noted at each press that can
 * move focus to a hex (Tab, or a pointer press inside the board), put back when a hex takes focus,
 * and `reveal` pans the board to a hex a key focused. Any other press forgets the note without
 * reading the layout.
 */
export function keepFocusedHexInBoard(reveal: (hexId: HexId) => void): Attachment<HTMLElement> {
    return (node) => {
        const document = node.ownerDocument
        let noted: ScrollPosition[] | undefined
        let byKey = false
        const press = (movesFocus: boolean, key: boolean) => {
            noted = movesFocus ? scrollPositions(node) : undefined
            byKey = key
        }
        const noteKey = (event: KeyboardEvent) => press(event.key === 'Tab', true)
        const notePointer = (event: PointerEvent) =>
            press(event.target instanceof Node && node.contains(event.target), false)
        const restore = (event: FocusEvent) => {
            const hexId = hexIdOf(event.target)
            if (!hexId) return
            for (const { element, left, top } of noted ?? []) {
                if (element.scrollLeft !== left) element.scrollLeft = left
                if (element.scrollTop !== top) element.scrollTop = top
            }
            noted = undefined
            // A pointer presses a hex it can see; a key may move focus to one out of view.
            if (byKey) reveal(hexId)
        }
        document.addEventListener('keydown', noteKey, { capture: true })
        document.addEventListener('pointerdown', notePointer, { capture: true })
        node.addEventListener('focusin', restore)
        return () => {
            document.removeEventListener('keydown', noteKey, { capture: true })
            document.removeEventListener('pointerdown', notePointer, { capture: true })
            node.removeEventListener('focusin', restore)
        }
    }
}
