import * as Type from 'typebox'
import { describe, expect, it } from 'vitest'
import * as Visibility from './index.js'

const perspective: Visibility.Perspective = { kind: 'player', playerId: 'alice' }

describe('projected execution collection guards', () => {
    it('rejects a root collection with protected members behind a reference', () => {
        const projector = Visibility.createProjector(
            Type.Cyclic(
                {
                    Items: Type.Array(Type.Ref('Secret')),
                    Secret: Visibility.protect(Type.Number(), {
                        policy: Visibility.Policy.HostOnly
                    })
                },
                'Items'
            )
        )
        const projected = projector.project([9], perspective)
        expect(projected).toEqual([])
        expect(() => projector.guardForExecution(projected, perspective)).toThrow(
            Visibility.UnavailableProjectedValueError
        )
    })

    it('rejects unprovable custom-policy membership while preserving public siblings', () => {
        const projector = Visibility.createProjector(
            Type.Object({
                count: Type.Number(),
                entries: Type.Record(
                    Type.String(),
                    Visibility.protect(Type.Number(), { policy: 'positive' })
                )
            }),
            { policies: { positive: ({ value }) => typeof value === 'number' && value > 0 } }
        )
        const projected = projector.project(
            { count: 2, entries: { hidden: -1, visible: 9 } },
            perspective
        )
        expect(projected.entries).toEqual({ visible: 9 })
        const guarded = projector.guardForExecution(projected, perspective)
        expect(guarded.count).toBe(2)
        expect(() => Reflect.ownKeys(guarded.entries)).toThrow(
            Visibility.UnavailableProjectedValueError
        )
    })

    it('rejects enumeration when additional properties may have been omitted', () => {
        const projector = Visibility.createProjector(
            Type.Object(
                { public: Type.Number() },
                {
                    additionalProperties: Visibility.protect(Type.Number(), {
                        policy: Visibility.Policy.HostOnly
                    })
                }
            )
        )
        const canonical = { public: 1, secret: 9 }
        const projected = projector.project(canonical, perspective)
        const guarded = projector.guardForExecution(projected, perspective)
        expect(guarded.public).toBe(1)
        expect(() => Object.keys(guarded)).toThrow(Visibility.UnavailableProjectedValueError)
    })

    it.each(['0', 'bob'])('guards every access to protected Record key %s', (key) => {
        const projector = Visibility.createProjector(
            Type.Object({
                bids: Type.Record(
                    Type.String(),
                    Visibility.protect(Type.Array(Type.Number()), {
                        policy: Visibility.Policy.HostOnly,
                        redaction: Visibility.redaction.emptyArray()
                    })
                )
            })
        )
        const projected = projector.project({ bids: { '0': [9], bob: [5] } }, perspective)
        const guarded = projector.guardForExecution(projected, perspective)
        expect(Reflect.ownKeys(guarded.bids)).toEqual(['0', 'bob'])
        for (const access of [
            () => Reflect.get(guarded.bids, key),
            () => Reflect.set(guarded.bids, key, []),
            () => Reflect.has(guarded.bids, key),
            () => Reflect.deleteProperty(guarded.bids, key),
            () => Reflect.defineProperty(guarded.bids, key, { value: [] }),
            () => Reflect.getOwnPropertyDescriptor(guarded.bids, key)
        ]) {
            expect(access).toThrow(Visibility.UnavailableProjectedValueError)
        }
    })

    it.each([{ items: [] }, { items: [1, 2] }])(
        'rejects incomplete arrays even when projected empty ($items)',
        ({ items }) => {
            const projector = Visibility.createProjector(
                Type.Object({
                    items: Type.Array(
                        Visibility.protect(Type.Number(), { policy: Visibility.Policy.HostOnly })
                    )
                })
            )
            const projected = projector.project({ items }, perspective)
            expect(projected.items).toEqual([])
            const guarded = projector.guardForExecution(projected, perspective)
            for (const access of [
                () => guarded.items.length,
                () => guarded.items.every(() => true),
                () => [...guarded.items],
                () => Object.keys(guarded.items),
                () => Reflect.get(guarded.items, '0'),
                () => guarded.items.push(3)
            ]) {
                expect(access).toThrow(Visibility.UnavailableProjectedValueError)
            }
        }
    )

    it('rejects enumeration of Records with omitted values', () => {
        const projector = Visibility.createProjector(
            Type.Object({
                bids: Type.Record(
                    Type.String(),
                    Visibility.protect(Type.Number(), { policy: Visibility.Policy.HostOnly })
                )
            })
        )
        const projected = projector.project({ bids: { '0': 9, bob: 5 } }, perspective)
        const guarded = projector.guardForExecution(projected, perspective)
        expect(() => Object.keys(guarded.bids)).toThrow(Visibility.UnavailableProjectedValueError)
        expect(() => Object.values(guarded.bids)).toThrow(Visibility.UnavailableProjectedValueError)
        expect(() => Reflect.get(guarded.bids, '0')).toThrow(
            Visibility.UnavailableProjectedValueError
        )
    })

    it('rejects collections whose union members can disappear', () => {
        const Entry = Type.Union([
            Type.Literal('public'),
            Visibility.protect(Type.Literal('secret'), { policy: Visibility.Policy.HostOnly })
        ])
        const projector = Visibility.createProjector(Type.Object({ items: Type.Array(Entry) }))
        const projected = projector.project({ items: ['secret', 'public'] }, perspective)
        expect(projected.items).toEqual(['public'])
        const guarded = projector.guardForExecution(projected, perspective)
        expect(() => guarded.items[0]).toThrow(Visibility.UnavailableProjectedValueError)
    })

    it('allows collection membership and public fields when only nested fields are omitted', () => {
        const Entry = Type.Object({
            id: Type.String(),
            secret: Visibility.protect(Type.Number(), { policy: Visibility.Policy.HostOnly })
        })
        const projector = Visibility.createProjector(
            Type.Object({
                items: Type.Array(Entry),
                entries: Type.Record(Type.String(), Entry)
            })
        )
        const guarded = projector.guardForExecution(
            projector.project(
                {
                    items: [{ id: 'one', secret: 9 }],
                    entries: { '0': { id: 'two', secret: 5 } }
                },
                perspective
            ),
            perspective
        )
        expect(guarded.items.length).toBe(1)
        expect(guarded.items.map((entry) => entry.id)).toEqual(['one'])
        expect(Object.keys(guarded.entries)).toEqual(['0'])
        expect(guarded.entries['0'].id).toBe('two')
        expect(() => guarded.entries['0'].secret).toThrow(Visibility.UnavailableProjectedValueError)
    })

    it('allows all actor-owned members and rejects another player’s incomplete collection', () => {
        const projector = Visibility.createProjector(
            Type.Object({
                playerId: Type.String(),
                items: Type.Array(
                    Visibility.protect(Type.Number(), { policy: Visibility.Policy.Actor })
                )
            })
        )
        const canonical = { playerId: 'alice', items: [9] }
        const guarded = projector.guardForExecution(
            projector.project(canonical, perspective),
            perspective
        )
        expect([...guarded.items]).toEqual([9])
        const spectator: Visibility.Perspective = { kind: 'spectator' }
        const other = projector.guardForExecution(
            projector.project(canonical, spectator),
            spectator
        )
        expect(() => other.items.length).toThrow(Visibility.UnavailableProjectedValueError)
    })
})
