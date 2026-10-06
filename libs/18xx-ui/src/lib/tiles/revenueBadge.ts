/**
 * Half the width of a fixed revenue badge: its circle's radius, stretched into a pill once a
 * revenue has three digits so the number keeps its type size.
 */
export function revenueBadgeHalfWidth(amount: number, radius: number, fontSize: number): number {
    const digits = String(amount).length
    return digits < 3 ? radius : Math.max(radius, (digits * 0.62 * fontSize) / 2 + radius * 0.45)
}
