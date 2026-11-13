import { describe, expect, it } from 'vitest'
import jsonpatch from 'fast-json-patch'
import { shuffle } from '../../util/shuffle.js'
import { Prng } from '../components/prng.js'
import { createPatch } from './statePatch.js'

function applied(from: unknown, to: unknown): unknown {
    const patch = createPatch(from, to)
    return jsonpatch.applyPatch(structuredClone(from), structuredClone(patch)).newDocument
}

function json(value: unknown): unknown {
    return JSON.parse(JSON.stringify(value))
}

function storedSize(value: unknown): number {
    return JSON.stringify(value).length
}

function cards(count: number): string[] {
    return Array.from({ length: count }, (_, index) => `card-${index}`)
}

function turn(playerId: string, start: number, end?: number) {
    return { type: 'turn', playerId, start, ...(end === undefined ? {} : { end }) }
}

describe('createPatch', () => {
    it('restores cards drawn from the top of a deck with one add each', () => {
        const before = { deck: cards(30) }
        const after = { deck: before.deck.slice(3) }

        expect(createPatch(after, before)).toEqual([
            { op: 'add', path: '/deck/0', value: 'card-0' },
            { op: 'add', path: '/deck/1', value: 'card-1' },
            { op: 'add', path: '/deck/2', value: 'card-2' }
        ])
        expect(createPatch(before, after)).toEqual([
            { op: 'remove', path: '/deck/2' },
            { op: 'remove', path: '/deck/1' },
            { op: 'remove', path: '/deck/0' }
        ])
    })

    it('diffs a changed element in place when the array length is unchanged', () => {
        expect(createPatch({ rows: [{ n: 1 }, { n: 2 }] }, { rows: [{ n: 1 }, { n: 3 }] })).toEqual(
            [{ op: 'replace', path: '/rows/1/n', value: 3 }]
        )
    })

    it('pairs the changed middle of a splice before inserting the remainder', () => {
        const from = { list: [...cards(10), 'x', ...cards(10)] }
        const to = { list: [...cards(10), 'y', 'z', ...cards(10)] }

        expect(createPatch(from, to)).toEqual([
            { op: 'replace', path: '/list/10', value: 'y' },
            { op: 'add', path: '/list/11', value: 'z' }
        ])
    })

    it('leaves the rest of a queue alone when its head leaves and its tail changes', () => {
        const before = {
            series: [turn('p1', 0, 1), turn('p2', 1, 2), turn('p3', 2, 3), turn('p4', 3)]
        }
        const after = {
            series: [turn('p2', 1, 2), turn('p3', 2, 3), turn('p4', 3, 4), turn('p1', 4)]
        }

        expect(createPatch(before, after)).toEqual([
            { op: 'remove', path: '/series/0' },
            { op: 'add', path: '/series/2/end', value: 4 },
            { op: 'add', path: '/series/3', value: turn('p1', 4) }
        ])
        expect(createPatch(after, before)).toEqual([
            { op: 'add', path: '/series/0', value: turn('p1', 0, 1) },
            { op: 'remove', path: '/series/3/end' },
            { op: 'remove', path: '/series/4' }
        ])
    })

    it('leaves the rest of a list alone when elements leave and join in separate places', () => {
        const from = { deck: cards(40) }
        const to = { deck: [...cards(40).filter((card) => card !== 'card-7'), 'joker'] }
        to.deck.splice(20, 0, 'wild')

        expect(createPatch(from, to)).toEqual([
            { op: 'remove', path: '/deck/7' },
            { op: 'add', path: '/deck/20', value: 'wild' },
            { op: 'add', path: '/deck/40', value: 'joker' }
        ])
        expect(json(applied(to, from))).toEqual(from)
    })

    it('keeps what a bag of repeated values still holds after draws from its middle', () => {
        const colours = ['red', 'blue', 'green', 'pink']
        const from = { bag: Array.from({ length: 60 }, (_, index) => colours[(index * 7) % 4]) }
        const to = { bag: from.bag.filter((_, index) => ![5, 22, 23, 48].includes(index)) }

        expect(createPatch(from, to).map(({ op }) => op)).toEqual(Array(4).fill('remove'))
        expect(createPatch(to, from).map(({ op }) => op)).toEqual(Array(4).fill('add'))
        expect(json(applied(from, to))).toEqual(to)
        expect(json(applied(to, from))).toEqual(from)
    })

    it('replaces a list or record whole when that is stored smaller than its changes', () => {
        expect(
            createPatch({ order: ['a', 'b', 'c', 'd'] }, { order: ['d', 'c', 'b', 'a'] })
        ).toEqual([{ op: 'replace', path: '/order', value: ['d', 'c', 'b', 'a'] }])
        expect(createPatch({ hand: ['a', 'b', 'c'] }, { hand: [] })).toEqual([
            { op: 'replace', path: '/hand', value: [] }
        ])
        expect(
            createPatch(
                { bid: { by: 'p1', amount: 3, round: 1 } },
                { bid: { by: 'p2', amount: 5, round: 2 } }
            )
        ).toEqual([{ op: 'replace', path: '/bid', value: { by: 'p2', amount: 5, round: 2 } }])
    })

    it('changes a large list in place when replacing it whole would be stored larger', () => {
        const from = { deck: cards(40) }
        const to = {
            deck: cards(40).map((card, index) => (index === 3 || index === 30 ? 'x' : card))
        }

        expect(createPatch(from, to)).toEqual([
            { op: 'replace', path: '/deck/3', value: 'x' },
            { op: 'replace', path: '/deck/30', value: 'x' }
        ])
    })

    it('never replaces the whole document', () => {
        expect(createPatch({ a: 1, b: 2 }, { a: 3, b: 4 })).toEqual([
            { op: 'replace', path: '/a', value: 3 },
            { op: 'replace', path: '/b', value: 4 }
        ])
    })

    it('pairs a long shuffled list by index once its search has run long enough', () => {
        const random = new Prng({ seed: 3, invocations: 0 })
        const from = { units: Array.from({ length: 900 }, (_, id) => ({ id, strength: id % 5 })) }
        const to = { units: structuredClone(from.units) }
        shuffle(to.units, random.random)

        expect(json(applied(from, to))).toEqual(to)
        expect(storedSize(createPatch(from, to))).toBeLessThan(storedSize(to) + 60)
    })

    it('finds the few changes in a long list', () => {
        const from = { units: Array.from({ length: 3000 }, (_, id) => ({ id, strength: id % 5 })) }
        const to = { units: from.units.filter(({ id }) => id !== 0 && id !== 1500) }
        to.units.push({ id: 3000, strength: 1 })

        expect(createPatch(from, to)).toEqual([
            { op: 'remove', path: '/units/0' },
            { op: 'remove', path: '/units/1499' },
            { op: 'add', path: '/units/2998', value: { id: 3000, strength: 1 } }
        ])
    })

    it('treats undefined properties as absent', () => {
        expect(createPatch({ a: 1, b: undefined }, { a: 1 })).toEqual([])
        expect(createPatch({ a: 1, b: 2 }, { a: 1, b: undefined })).toEqual([
            { op: 'remove', path: '/b' }
        ])
        expect(createPatch({ a: undefined }, { a: 2 })).toEqual([
            { op: 'add', path: '/a', value: 2 }
        ])
        expect(
            createPatch({ list: [{ a: 1, b: undefined }, 'x', 'y'] }, { list: [{ a: 1 }, 'y'] })
        ).toEqual([{ op: 'remove', path: '/list/1' }])
    })

    it('tells apart elements that differ only in which properties they hold', () => {
        expect(
            createPatch({ list: [{ a: undefined }, 'x'] }, { list: [{ b: false }, 'x'] })
        ).toEqual([{ op: 'add', path: '/list/0/b', value: false }])
        expect(
            createPatch({ list: ['x', { a: 1 }] }, { list: ['x', { a: 1, b: undefined }] })
        ).toEqual([])
    })

    it('escapes JSON Pointer characters in keys', () => {
        expect(createPatch({}, { 'a/b~c': 1 })).toEqual([{ op: 'add', path: '/a~1b~0c', value: 1 }])
    })

    it('replaces values whose kind changes', () => {
        expect(createPatch({ v: [1] }, { v: { 0: 1 } })).toEqual([
            { op: 'replace', path: '/v', value: { 0: 1 } }
        ])
        expect(createPatch({ v: null }, { v: 'x' })).toEqual([
            { op: 'replace', path: '/v', value: 'x' }
        ])
        expect(createPatch({ v: { length: 0 } }, { v: [] })).toEqual([
            { op: 'replace', path: '/v', value: [] }
        ])
    })

    it('copies values rather than sharing them with the target', () => {
        const to = { list: [{ n: 1 }], whole: { a: [1], b: [2] } }
        const patch = createPatch({ list: [], whole: { a: [3], b: [4] } }, to)
        to.list[0].n = 2
        to.whole.a[0] = 5

        expect(patch).toEqual([
            { op: 'add', path: '/list/0', value: { n: 1 } },
            { op: 'replace', path: '/whole', value: { a: [1], b: [2] } }
        ])
    })

    it('writes the same patch for the same states', () => {
        const from = { deck: cards(40), series: [turn('p1', 0, 1), turn('p2', 1)] }
        const to = { deck: cards(40).toReversed(), series: [turn('p2', 1, 2), turn('p1', 2)] }

        expect(createPatch(structuredClone(from), structuredClone(to))).toEqual(
            createPatch(from, to)
        )
    })

    it.each([7, 8, 9, 10])('round-trips random edits of nested arrays and records %i', (seed) => {
        const random = new Prng({ seed, invocations: 0 })
        const pick = (count: number) => random.randInt(count)
        const leaf = () =>
            pick(2) === 0 ? `c${pick(20)}` : { id: pick(5), tags: [pick(3)], at: { row: pick(4) } }
        const leaves = (count: number) => Array.from({ length: count }, leaf)
        const mutate = (list: unknown[]) => {
            const edits = [
                () => list.splice(0, 1 + pick(3)),
                () => list.unshift(leaf(), leaf()),
                () => list.splice(pick(list.length + 1), pick(3), ...leaves(pick(3))),
                () => list.push(leaf()),
                () => list.pop(),
                () => list.reverse(),
                () => list.push(list.shift()),
                () => list.sort(() => pick(3) - 1),
                () => {
                    const edited = list[pick(list.length)]
                    if (typeof edited === 'object' && edited !== null) Reflect.set(edited, 'id', 9)
                }
            ]
            for (let count = 1 + pick(3); count > 0; count--) edits[pick(edits.length)]()
        }

        for (let run = 0; run < 1500; run++) {
            const emptyPile: unknown[] = []
            const from = {
                deck: leaves(pick(run % 10 === 0 ? 80 : 12)),
                piles: { a: leaves(pick(6)), b: emptyPile },
                rows: [leaves(pick(4)), leaves(pick(4))],
                count: pick(10)
            }
            const to = structuredClone(from)
            mutate(to.deck)
            mutate(to.piles.a)
            mutate(to.rows[pick(2)])
            if (pick(3) === 0) to.rows.reverse()
            if (pick(3) === 0) to.piles.b.push(leaf())
            if (pick(3) === 0) to.count++

            expect(json(applied(from, to))).toEqual(json(to))
            expect(json(applied(to, from))).toEqual(json(from))
        }
    })
})
