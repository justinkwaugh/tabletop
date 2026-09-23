export type PopoverAbove = { left: number; bottom: number }

export function popoverAbove(anchor: HTMLElement, width = 0, margin = 8): PopoverAbove {
    const bounds = anchor.getBoundingClientRect()
    return {
        left: Math.max(margin, Math.min(bounds.left, window.innerWidth - width - margin)),
        bottom: window.innerHeight - bounds.top + 6
    }
}
