/** The scale that fits a panel of `natural` px into `budget` px, and the box height that leaves. */
export function fittedSize(natural: number, budget: number): { scale: number; height: number } {
    if (natural <= 0 || budget <= 0) return { scale: 1, height: natural }
    const scale = Math.min(1, budget / natural)
    return { scale, height: Math.ceil(natural * scale) }
}
