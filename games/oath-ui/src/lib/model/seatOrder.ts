/** The turn order turned so the viewer's own seat comes first; the rest keep their order. */
export function viewerFirst<T>(order: readonly T[], isViewer: (seat: T) => boolean): T[] {
    const at = order.findIndex(isViewer)
    return at <= 0 ? [...order] : [...order.slice(at), ...order.slice(0, at)]
}
