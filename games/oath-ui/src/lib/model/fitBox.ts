/** The smallest scale a panel is drawn at; a panel taller than its budget at this scale scrolls. */
export const MIN_FIT_SCALE = 0.75

/**
 * The scale that fits a panel of `natural` px into `budget` px, never below `MIN_FIT_SCALE`, and
 * the box height that leaves: the drawn panel's, or the budget's when the panel at the minimum is
 * still taller and so scrolls inside it.
 */
export function fittedSize(
    natural: number,
    budget: number
): { scale: number; height: number; scrolls: boolean } {
    if (natural <= 0 || budget <= 0) return { scale: 1, height: natural, scrolls: false }
    const fits = Math.min(1, budget / natural)
    const scale = Math.max(MIN_FIT_SCALE, fits)
    const scrolls = scale > fits
    return { scale, height: Math.ceil(scrolls ? budget : natural * scale), scrolls }
}
