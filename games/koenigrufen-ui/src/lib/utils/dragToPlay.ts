import type { Attachment } from 'svelte/attachments'
import { assertExists } from '@tabletop/common'

const DragThreshold = 6

export type DragToPlay = {
    enabled: boolean
    onDrop: () => Promise<void>
}

type DragStart = { x: number; y: number; pointerId: number; scale: number }

// The drop zone is the table above its edge marker, the player's own name plate.
function isOverDropZone(element: HTMLElement, x: number, y: number): boolean {
    const zone = element.closest('[data-drop-zone]')
    assertExists(zone, 'A draggable card sits inside the drop zone')
    const edge = zone.querySelector('[data-drop-edge]')
    assertExists(edge, 'The drop zone marks its lower edge')
    const area = zone.getBoundingClientRect()
    return (
        x >= area.left && x <= area.right && y >= area.top && y < edge.getBoundingClientRect().top
    )
}

// The board is scaled, so pointer travel is divided by the element's on-screen scale.
function scaleOf(element: HTMLElement): number {
    return element.offsetWidth > 0 ? element.getBoundingClientRect().width / element.offsetWidth : 1
}

// Drags the element with the pointer and plays it when dropped in the drop zone. A press that never
// travels past the threshold stays an ordinary click.
export function dragToPlay(drag: DragToPlay): Attachment<HTMLElement> {
    return (element) => {
        if (!drag.enabled) {
            return
        }
        let start: DragStart | undefined
        let dragging = false
        let swallowClick = false

        function follow(dx: number, dy: number, scale: number) {
            element.style.transform = `translate(${dx / scale}px, ${dy / scale}px)`
        }

        function settle() {
            element.style.removeProperty('transform')
            element.style.removeProperty('transition')
            element.style.removeProperty('z-index')
        }

        function onPointerDown(event: PointerEvent) {
            if (event.button !== 0 || !event.isPrimary) {
                return
            }
            start = {
                x: event.clientX,
                y: event.clientY,
                pointerId: event.pointerId,
                scale: scaleOf(element)
            }
        }

        function onPointerMove(event: PointerEvent) {
            if (start === undefined || event.pointerId !== start.pointerId) {
                return
            }
            const dx = event.clientX - start.x
            const dy = event.clientY - start.y
            if (!dragging) {
                if (Math.hypot(dx, dy) < DragThreshold) {
                    return
                }
                dragging = true
                element.setPointerCapture(event.pointerId)
                element.style.transition = 'none'
                element.style.zIndex = '50'
            }
            follow(dx, dy, start.scale)
        }

        async function onPointerUp(event: PointerEvent) {
            if (start === undefined || event.pointerId !== start.pointerId) {
                return
            }
            const dropped = dragging && isOverDropZone(element, event.clientX, event.clientY)
            const wasDragging = dragging
            start = undefined
            dragging = false
            if (!wasDragging) {
                return
            }
            swallowClick = true
            setTimeout(() => (swallowClick = false))
            if (dropped) {
                await drag.onDrop().finally(settle)
            } else {
                settle()
            }
        }

        function onPointerCancel() {
            start = undefined
            dragging = false
            settle()
        }

        function onClickCapture(event: MouseEvent) {
            if (swallowClick) {
                swallowClick = false
                event.stopPropagation()
                event.preventDefault()
            }
        }

        element.addEventListener('pointerdown', onPointerDown)
        element.addEventListener('pointermove', onPointerMove)
        element.addEventListener('pointerup', onPointerUp)
        element.addEventListener('pointercancel', onPointerCancel)
        element.addEventListener('click', onClickCapture, true)
        return () => {
            element.removeEventListener('pointerdown', onPointerDown)
            element.removeEventListener('pointermove', onPointerMove)
            element.removeEventListener('pointerup', onPointerUp)
            element.removeEventListener('pointercancel', onPointerCancel)
            element.removeEventListener('click', onClickCapture, true)
            settle()
        }
    }
}
