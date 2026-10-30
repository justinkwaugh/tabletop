export function nextTabIndex(key: string, current: number, count: number): number | undefined {
    if (key === 'ArrowRight') return (current + 1) % count
    if (key === 'ArrowLeft') return (current + count - 1) % count
    if (key === 'Home') return 0
    if (key === 'End') return count - 1
    return undefined
}
