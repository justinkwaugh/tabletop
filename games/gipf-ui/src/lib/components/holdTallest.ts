import type { Attachment } from 'svelte/attachments'

// Holds the action panel at the tallest height it has reached, so a line that wraps for a long name
// does not move the board each time the panel shrinks back. A new width starts over, since the
// wrapping changes with it; the reset waits a frame so the observer never re-enters its own change.
export const holdTallest: Attachment<HTMLElement> = (node) => {
    let width = node.clientWidth
    let tallest = 0
    let frame = 0

    const hold = () => {
        const height = node.offsetHeight
        if (height <= tallest) return
        tallest = height
        const style = getComputedStyle(node)
        const frameHeight =
            style.boxSizing === 'content-box'
                ? parseFloat(style.paddingTop) +
                  parseFloat(style.paddingBottom) +
                  parseFloat(style.borderTopWidth) +
                  parseFloat(style.borderBottomWidth)
                : 0
        node.style.minHeight = `${height - frameHeight}px`
    }

    const observer = new ResizeObserver(() => {
        if (node.clientWidth === width) {
            hold()
            return
        }
        width = node.clientWidth
        cancelAnimationFrame(frame)
        frame = requestAnimationFrame(() => {
            tallest = 0
            node.style.minHeight = ''
            hold()
        })
    })
    observer.observe(node)
    hold()

    return () => {
        observer.disconnect()
        cancelAnimationFrame(frame)
    }
}
