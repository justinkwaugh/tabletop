import type { Attachment } from 'svelte/attachments'

/**
 * For an element over the board that scrolls on its own. The board's wrapper pans the board on
 * any one-finger drag, mouse drag or wheel inside it, and cancels the browser's own scroll as it
 * does. While the element is longer or wider than its room, those that start on it stop here, so
 * the browser scrolls it and the board stays put; at the element's end nothing moves. While it
 * fits, they reach the board, as beside it. Two fingers, and Ctrl with the wheel, always reach
 * the board and zoom it, so a pinch never zooms the page. Only for an element that holds no
 * control: a press on a control must reach the wrapper, whose press starts each click afresh.
 */
export const scrollsOnItsOwn: Attachment<HTMLElement> = (node) => {
    const overflows = () =>
        node.scrollWidth > node.clientWidth || node.scrollHeight > node.clientHeight
    const keepOneFinger = (event: TouchEvent) => {
        if (event.touches.length === 1 && overflows()) event.stopPropagation()
    }
    const keepWheel = (event: WheelEvent) => {
        if (!event.ctrlKey && overflows()) event.stopPropagation()
    }
    const keepPress = (event: MouseEvent) => {
        if (overflows()) event.stopPropagation()
    }
    node.addEventListener('touchmove', keepOneFinger, { passive: true })
    node.addEventListener('wheel', keepWheel, { passive: true })
    node.addEventListener('mousedown', keepPress)
    return () => {
        node.removeEventListener('touchmove', keepOneFinger)
        node.removeEventListener('wheel', keepWheel)
        node.removeEventListener('mousedown', keepPress)
    }
}
