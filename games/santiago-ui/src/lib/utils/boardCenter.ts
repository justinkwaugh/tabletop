import type { Attachment } from 'svelte/attachments'

// Keeps `--board-center` on the element above the board set to the board's horizontal center,
// measured from that element's left edge in screen pixels, so text and controls inside it can
// center over just the board rather than the board and the tile strip beside it. It measures
// every frame because ScalingWrapper's pan and zoom move the board by a CSS transform, with no
// resize event or store to hook; it writes the DOM directly and only when the value changes, so
// nothing reactive runs per frame.
export function centerOverBoard(getBoardEl: () => HTMLElement | undefined): Attachment<HTMLElement> {
    return (bar) => {
        let frame = 0
        let written = ''
        const measure = () => {
            const board = getBoardEl()
            if (board) {
                const boardRect = board.getBoundingClientRect()
                const barRect = bar.getBoundingClientRect()
                const value = `${boardRect.left + boardRect.width / 2 - barRect.left}px`
                if (value !== written) {
                    bar.style.setProperty('--board-center', value)
                    written = value
                }
            }
            frame = requestAnimationFrame(measure)
        }
        frame = requestAnimationFrame(measure)
        return () => cancelAnimationFrame(frame)
    }
}
