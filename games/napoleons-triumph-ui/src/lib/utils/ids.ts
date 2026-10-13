export function sameIds(a: readonly string[], b: readonly string[]): boolean {
    return a.length === b.length && a.every((id) => b.includes(id))
}

export function firstOfEach<Item>(items: Iterable<Item>, keyOf: (item: Item) => string): Item[] {
    const first = new Map<string, Item>()
    for (const item of items) {
        const key = keyOf(item)
        if (!first.has(key)) {
            first.set(key, item)
        }
    }
    return [...first.values()]
}
