import { describe, expect, it } from 'vitest'
import jsonpatch from 'fast-json-patch'
import { createPatch } from './statePatch.js'

function applied(from: unknown, to: unknown): unknown {
    const patch = createPatch(from, to)
    return jsonpatch.applyPatch(structuredClone(from), structuredClone(patch)).newDocument
}

function json(value: unknown): unknown {
    return JSON.parse(JSON.stringify(value))
}

describe('createPatch', () => {
    it('restores cards drawn from the top of a deck with one add each', () => {
        const before = { deck: ['a', 'b', 'c', 'd', 'e', 'f'] }
        const after = { deck: ['d', 'e', 'f'] }

        expect(createPatch(after, before)).toEqual([
            { op: 'add', path: '/deck/0', value: 'a' },
            { op: 'add', path: '/deck/1', value: 'b' },
            { op: 'add', path: '/deck/2', value: 'c' }
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
        const from = { list: ['a', 'x', 'b'] }
        const to = { list: ['a', 'y', 'z', 'b'] }

        expect(createPatch(from, to)).toEqual([
            { op: 'replace', path: '/list/1', value: 'y' },
            { op: 'add', path: '/list/2', value: 'z' }
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
    })

    it('copies values rather than sharing them with the target', () => {
        const to = { list: [{ n: 1 }] }
        const patch = createPatch({ list: [] }, to)
        to.list[0].n = 2

        expect(patch).toEqual([{ op: 'add', path: '/list/0', value: { n: 1 } }])
    })

    it('round-trips random edits of nested arrays and records', () => {
        let seed = 7
        const random = () => {
            seed = (seed * 1103515245 + 12345) % 2147483648
            return seed / 2147483648
        }
        const pick = (n: number) => Math.floor(random() * n)
        const leaf = () => (random() < 0.5 ? `c${pick(20)}` : { id: pick(5), tags: [pick(3)] })
        const mutate = (list: unknown[]) => {
            const edits = [
                () => list.splice(0, 1 + pick(3)),
                () => list.unshift(leaf(), leaf()),
                () =>
                    list.splice(
                        pick(list.length + 1),
                        pick(3),
                        ...[leaf(), leaf()].slice(0, pick(3))
                    ),
                () => list.push(leaf()),
                () => list.pop(),
                () => list.reverse()
            ]
            edits[pick(edits.length)]()
        }

        for (let run = 0; run < 500; run++) {
            const emptyPile: unknown[] = []
            const from = {
                deck: Array.from({ length: pick(12) }, leaf),
                piles: { a: Array.from({ length: pick(6) }, leaf), b: emptyPile },
                count: pick(10)
            }
            const to = structuredClone(from)
            mutate(to.deck)
            mutate(to.piles.a)
            if (random() < 0.3) to.piles.b.push(leaf())
            if (random() < 0.3) to.count++

            expect(json(applied(from, to))).toEqual(json(to))
            expect(json(applied(to, from))).toEqual(json(from))
        }
    })
})
