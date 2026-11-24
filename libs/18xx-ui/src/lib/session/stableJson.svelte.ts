/**
 * A derived value that keeps its identity while its content is unchanged, so a change elsewhere
 * in the preferences doesn't redraw what reads it.
 */
export function stableJson<T>(read: () => T): () => T {
    const text = $derived(JSON.stringify(read()))
    const value: T = $derived(JSON.parse(text))
    return () => value
}
