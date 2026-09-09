export function jsonEntries(value: unknown): [string, unknown][] {
    if (value === null || typeof value !== 'object' || value instanceof Date) return []
    return Object.entries(value)
}

export function formatJsonValue(value: unknown): string {
    if (typeof value === 'string') return JSON.stringify(value)
    if (value instanceof Date) return value.toISOString()
    if (Array.isArray(value)) return value.length === 0 ? '[]' : `Array(${value.length})`
    if (value !== null && typeof value === 'object') return '{}'
    return String(value)
}

export function jsonPreview(value: unknown): string {
    const entries = jsonEntries(value)
    const preview = entries
        .slice(0, 3)
        .map(([key, child]) => {
            const formatted = formatJsonValue(child)
            const short = formatted.length > 48 ? `${formatted.slice(0, 48)}…` : formatted
            return Array.isArray(value) ? short : `${key}: ${short}`
        })
        .join(', ')
    return `${preview}${entries.length > 3 ? ', …' : ''}`
}
