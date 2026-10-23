import type { Attachment } from 'svelte/attachments'

// Where the board's middle is, on screen and within the table, and how large a board unit is,
// so the table's storm lines up with the one in the board as the board is fitted, zoomed and
// panned. Within the table it holds still while a phone scrolls the table sideways.
export type StormPlacement = {
    screen: { x: number; y: number }
    table: { x: number; y: number }
    scale: number
}

export function trackStorm(set: (placement: StormPlacement) => void): Attachment<HTMLElement> {
    return (container) => {
        let frame = 0
        const read = () => {
            frame = 0
            const board = container.querySelector<SVGSVGElement>('svg.yinsh-board')
            const matrix = board?.getScreenCTM()
            const table = container.closest('.yinsh-table')?.getBoundingClientRect()
            if (!matrix || !table) return
            set({
                screen: { x: matrix.e, y: matrix.f },
                table: { x: matrix.e - table.left, y: matrix.f - table.top },
                scale: matrix.a
            })
        }
        const schedule = () => {
            if (frame === 0) frame = requestAnimationFrame(read)
        }
        const resizes = new ResizeObserver(schedule)
        resizes.observe(container)
        const board = container.querySelector('svg.yinsh-board')
        if (board) resizes.observe(board)
        // Zooming and panning move the board by transform, which no resize reports.
        const moves = new MutationObserver(schedule)
        moves.observe(container, { attributes: true, subtree: true, attributeFilter: ['style'] })
        window.addEventListener('resize', schedule)
        schedule()
        return () => {
            resizes.disconnect()
            moves.disconnect()
            window.removeEventListener('resize', schedule)
            if (frame !== 0) cancelAnimationFrame(frame)
        }
    }
}
