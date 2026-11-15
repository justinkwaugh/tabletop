/**
 * The vault's stacks are stored top first, and the records of known places in a pile or under the
 * world deck bottom first (the relic deck's known bottom runs top first, like the deck). Recorded
 * games replay against these orders as stored, so none flips; every move between them goes through
 * here.
 */

export function topOf<T>(stack: readonly T[]): T | undefined {
    return stack[0]
}

export function topCards<T>(stack: readonly T[], count: number): T[] {
    return stack.slice(0, count)
}

export function drawFromTop<T>(stack: T[], count: number): T[] {
    return count > 0 ? stack.splice(0, count) : []
}

/** Deepest card first. */
export function drawFromBottom<T>(stack: T[], count: number): T[] {
    return count > 0 ? stack.splice(Math.max(0, stack.length - count), count).reverse() : []
}

/** One at a time in the order given, so the last ends on top. */
export function putOnTop<T>(stack: T[], cards: readonly T[]): void {
    for (const card of cards) stack.unshift(card)
}

/** One at a time in the order given, so the last ends at the bottom. */
export function putUnderneath<T>(stack: T[], cards: readonly T[]): void {
    stack.push(...cards)
}

/** Land Warden — under the top `beneath` cards, the last given nearest them. */
export function putUnderTop<T>(stack: T[], cards: readonly T[], beneath: number): void {
    stack.splice(beneath, 0, ...cards.toReversed())
}

/** A whole pile set down on top, in its own order. */
export function putPileOnTop<T>(stack: T[], pile: readonly T[]): void {
    stack.unshift(...pile)
}

export function bottomIndexFromTop(size: number, fromTop: number): number {
    return size - 1 - fromTop
}

export function topIndexFromBottom(size: number, fromBottom: number): number {
    return size - 1 - fromBottom
}

export function topFirst<T>(bottomFirstList: readonly T[]): T[] {
    return bottomFirstList.toReversed()
}

export function bottomFirst<T>(topFirstList: readonly T[]): T[] {
    return topFirstList.toReversed()
}

function unknownPlaces(count: number): null[] {
    return Array.from({ length: count }, () => null)
}

export function recordWithEntry<T>(
    record: readonly (T | null)[],
    fromBottom: number,
    entry: T | null
): (T | null)[] {
    const known = [...record, ...unknownPlaces(Math.max(0, fromBottom + 1 - record.length))]
    known[fromBottom] = entry
    return known
}

/** A stack of `before` cards drawn from the top down to `remaining`. */
export function recordAfterTopDraw<T>(
    record: readonly T[],
    remaining: number,
    before: number
): { drawn: T[]; kept: T[] } {
    return { drawn: record.slice(remaining, before), kept: record.slice(0, remaining) }
}

export function recordAfterBottomDraw<T>(
    record: readonly T[],
    count: number
): { drawn: T[]; kept: T[] } {
    return { drawn: record.slice(0, count), kept: record.slice(count) }
}

/** `count` cards slipped in at `fromBottom` lift every known place from there up. */
export function recordLifted<T>(
    record: readonly (T | null)[],
    fromBottom: number,
    count: number
): (T | null)[] {
    return [...record.slice(0, fromBottom), ...unknownPlaces(count), ...record.slice(fromBottom)]
}

/** A pile set down on a stack of `size` cards: the stack's record, then the pile's above it. */
export function recordWithPileOnTop<T>(
    record: readonly (T | null)[],
    size: number,
    pileRecord: readonly (T | null)[]
): (T | null)[] {
    return [...record, ...unknownPlaces(size - record.length), ...pileRecord]
}

/** Unknown places above the highest known one say nothing. */
export function trimUnknownTop<T>(record: readonly (T | null)[]): (T | null)[] {
    let end = record.length
    while (end > 0 && record[end - 1] === null) end -= 1
    return record.slice(0, end)
}
