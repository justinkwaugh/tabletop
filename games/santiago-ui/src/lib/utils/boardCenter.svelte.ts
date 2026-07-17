// Tracks an element's live horizontal center relative to another element, so a bar of
// text/controls can stay centered over just the board rather than the board + tile strip
// beside it. Board.svelte doesn't expose a bindable root element, so callers pass plain
// DOM refs (measured via getBoundingClientRect) for both the board and the bar above it.
// Uses a continuous rAF loop rather than resize/mount only, because ScalingWrapper's
// pan/zoom moves the board via CSS transform with no resize event or exposed store to hook.
export function useBoardCenterX(
    getBoardEl: () => HTMLElement | undefined,
    getBarEl: () => HTMLElement | undefined
) {
    let centerX = $state<number | null>(null)

    $effect(() => {
        let raf: number
        function measure() {
            const boardEl = getBoardEl()
            const barEl = getBarEl()
            if (boardEl && barEl) {
                const boardRect = boardEl.getBoundingClientRect()
                const barRect = barEl.getBoundingClientRect()
                centerX = boardRect.left + boardRect.width / 2 - barRect.left
            }
            raf = requestAnimationFrame(measure)
        }
        raf = requestAnimationFrame(measure)
        return () => cancelAnimationFrame(raf)
    })

    return {
        get value() {
            return centerX
        }
    }
}
