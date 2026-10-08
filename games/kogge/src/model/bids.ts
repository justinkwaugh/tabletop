import { sameMarkers, withoutMarkers } from '../components/routeMarkers.js'

interface PrimaryGroup {
    value: number
    size: number
}

function primaryGroup(markers: readonly number[]): PrimaryGroup {
    const tally = markerTally(markers)
    let best: PrimaryGroup = { value: -1, size: 0 }
    for (const [value, size] of tally) {
        if (size > best.size || (size === best.size && value > best.value)) {
            best = { value, size }
        }
    }
    return best
}

// Rulebook and designer rulings (BGG thread 658791): a bid holding two or more identical
// markers is a group bid; a larger group beats a smaller one, then the higher group value,
// then the markers beside the group compared the same way (4+4 > 3+3+6 > 3+3 > 8). Bids
// of distinct markers compare their sum, then their markers from the highest down, and a
// marker beats no marker (5+0 > 5 > 4+1 > 0).
export function compareBids(a: readonly number[], b: readonly number[]): number {
    if (a.length === 0 || b.length === 0) {
        return Math.sign(a.length) - Math.sign(b.length)
    }
    const groupA = primaryGroup(a)
    const groupB = primaryGroup(b)
    const groupSizeA = groupA.size >= 2 ? groupA.size : 1
    const groupSizeB = groupB.size >= 2 ? groupB.size : 1
    if (groupSizeA !== groupSizeB) {
        return groupSizeA - groupSizeB
    }
    if (groupSizeA === 1) {
        return compareDistinctBids(a, b)
    }
    if (groupA.value !== groupB.value) {
        return groupA.value - groupB.value
    }
    const group = Array<number>(groupA.size).fill(groupA.value)
    return compareBids(withoutMarkers(a, group), withoutMarkers(b, group))
}

function compareDistinctBids(a: readonly number[], b: readonly number[]): number {
    const sumA = a.reduce((total, marker) => total + marker, 0)
    const sumB = b.reduce((total, marker) => total + marker, 0)
    if (sumA !== sumB) {
        return sumA - sumB
    }
    const descendingA = a.toSorted((x, y) => y - x)
    const descendingB = b.toSorted((x, y) => y - x)
    const length = Math.max(descendingA.length, descendingB.length)
    for (let index = 0; index < length; index++) {
        const markerA = descendingA[index]
        const markerB = descendingB[index]
        if (markerA === undefined || markerB === undefined) {
            return markerA === undefined ? -1 : 1
        }
        if (markerA !== markerB) {
            return markerA - markerB
        }
    }
    return 0
}

export function duplicatesBid(markers: readonly number[], bids: readonly (readonly number[])[]) {
    return bids.some((bid) => bid.length > 0 && sameMarkers(bid, markers))
}

export function distinctSubBids(hand: readonly number[]): number[][] {
    const counts = markerTally(hand)
    const values = [...counts.keys()].toSorted((a, b) => a - b)
    const bids: number[][] = [[]]
    for (const value of values) {
        const count = counts.get(value) ?? 0
        const extended: number[][] = []
        for (const bid of bids) {
            for (let copies = 0; copies <= count; copies++) {
                extended.push([...bid, ...Array<number>(copies).fill(value)])
            }
        }
        bids.splice(0, bids.length, ...extended)
    }
    return bids.filter((bid) => bid.length > 0)
}

export function hasLegalBid(hand: readonly number[], bids: readonly (readonly number[])[]) {
    const madeBids = bids.filter((bid) => bid.length > 0)
    if (distinctSubBidCount(hand) > madeBids.length) {
        return true
    }
    return distinctSubBids(hand).some((bid) => !duplicatesBid(bid, madeBids))
}

function distinctSubBidCount(hand: readonly number[]): number {
    return [...markerTally(hand).values()].reduce((product, count) => product * (count + 1), 1) - 1
}

function markerTally(hand: readonly number[]): Map<number, number> {
    const counts = new Map<number, number>()
    for (const marker of hand) {
        counts.set(marker, (counts.get(marker) ?? 0) + 1)
    }
    return counts
}
