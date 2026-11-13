export function escapePointerSegment(segment: string | number): string {
    const text = String(segment)
    if (!text.includes('~') && !text.includes('/')) return text
    return text.replaceAll('~', '~0').replaceAll('/', '~1')
}
