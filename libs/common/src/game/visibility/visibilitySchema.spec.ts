import { Compile } from 'typebox/compile'
import * as Type from 'typebox'
import { describe, expect, expectTypeOf, it } from 'vitest'
import { DrawBag } from '../components/drawBag.js'
import * as Visibility from './index.js'

describe('visibility schemas', () => {
    it('adds a named scope without changing the canonical or projected value type', () => {
        const Auction = Visibility.scope(
            Type.Object({
                id: Type.String(),
                participants: Type.Array(Type.String())
            }),
            'example.auction'
        )
        const Canonical = Type.Object({
            currentAuction: Type.Optional(Auction)
        })
        const Projection = Visibility.createProjectionSchema(Canonical)

        expect(Auction[Visibility.ScopeKey]).toBe('example.auction')
        expect(Canonical.properties.currentAuction[Visibility.ScopeKey]).toBe('example.auction')
        expect(Projection.properties.currentAuction[Visibility.ScopeKey]).toBe('example.auction')
        expectTypeOf<Type.Static<typeof Canonical>>().toEqualTypeOf<{
            currentAuction?: {
                id: string
                participants: string[]
            }
        }>()
        expectTypeOf<Type.Static<typeof Projection>>().toEqualTypeOf<{
            currentAuction?: {
                id: string
                participants: string[]
            }
        }>()
    })

    it('adds serializable visibility metadata without changing the canonical schema', () => {
        const Secret = Visibility.protect(Type.Number(), { policy: 'example.secret' })
        const Canonical = Type.Object({
            publicValue: Type.String(),
            secret: Secret
        })

        expect(Secret[Visibility.MetadataKey]).toEqual({
            policy: 'example.secret',
            redaction: { kind: 'omit' }
        })
        expect(Canonical.required).toEqual(['publicValue', 'secret'])
        expect(Compile(Canonical).Check({ publicValue: 'visible', secret: 42 })).toBe(true)
        expect(Compile(Canonical).Check({ publicValue: 'visible' })).toBe(false)
        expectTypeOf<Type.Static<typeof Canonical>>().toEqualTypeOf<{
            publicValue: string
            secret: number
        }>()
    })

    it('derives omitted fields as optional while leaving unannotated fields public', () => {
        const Canonical = Type.Object({
            id: Type.String(),
            nested: Type.Object({
                label: Type.String(),
                bid: Visibility.protect(Type.Number(), { policy: 'example.sealed-bid' })
            })
        })
        const Projection = Visibility.createProjectionSchema(Canonical)
        const validator = Compile(Projection)

        expect(Canonical.properties.nested.required).toEqual(['label', 'bid'])
        expect(Projection.properties.nested.required).toEqual(['label'])
        expect(validator.Check({ id: 'auction', nested: { label: 'A' } })).toBe(true)
        expect(validator.Check({ nested: { label: 'A' } })).toBe(false)
        expect(validator.Check({ id: 'auction', nested: {} })).toBe(false)
        expectTypeOf<Type.Static<typeof Projection>>().toEqualTypeOf<{
            id: string
            nested: {
                label: string
                bid?: number
            }
        }>()
    })

    it('recurses through arrays and TypeBox composition', () => {
        const Participant = Type.Object({
            playerId: Type.String(),
            bid: Visibility.protect(Type.Optional(Type.Number({ minimum: 0 })), {
                policy: 'example.sealed-bid'
            }),
            privateNote: Visibility.protect(Type.String(), {
                policy: 'example.private-note'
            })
        })
        const Canonical = Type.Evaluate(
            Type.Intersect([
                Type.Object({ id: Type.String() }),
                Type.Object({ participants: Type.Array(Participant) })
            ])
        )
        const Projection = Visibility.createProjectionSchema(Canonical)
        const validator = Compile(Projection)

        expect(
            validator.Check({
                id: 'auction',
                participants: [{ playerId: 'player-1' }, { playerId: 'player-2', bid: 4 }]
            })
        ).toBe(true)
        expect(
            validator.Check({
                id: 'auction',
                participants: [{ bid: 4 }]
            })
        ).toBe(false)
        expectTypeOf<Type.Static<typeof Projection>>().toEqualTypeOf<{
            id: string
            participants: {
                playerId: string
                bid?: number
                privateNote?: string
            }[]
        }>()
    })

    it('allows replacement redactions to declare a different projected representation', () => {
        const Canonical = Type.Object({
            secret: Visibility.protect(Type.String(), {
                policy: 'example.secret',
                redaction: Visibility.redaction.replaceWith('example.presence', Type.Boolean())
            })
        })
        const Projection = Visibility.createProjectionSchema(Canonical)
        const canonicalValidator = Compile(Canonical)
        const projectionValidator = Compile(Projection)

        expect(canonicalValidator.Check({ secret: 'canonical' })).toBe(true)
        expect(canonicalValidator.Check({ secret: true })).toBe(false)
        expect(projectionValidator.Check({ secret: 'canonical' })).toBe(true)
        expect(projectionValidator.Check({ secret: true })).toBe(true)
        expect(projectionValidator.Check({})).toBe(false)
        expectTypeOf<Type.Static<typeof Projection>>().toEqualTypeOf<{
            secret: string | boolean
        }>()
    })

    it('provides a reusable empty-array replacement for host-only collections', () => {
        const Canonical = DrawBag(Type.String())
        const Projection = Visibility.createProjectionSchema(Canonical)

        expect(Canonical.properties.items[Visibility.MetadataKey]).toMatchObject({
            policy: Visibility.Policy.HostOnly,
            redaction: {
                kind: 'replace',
                adapter: 'tabletop.empty-array'
            }
        })
        expect(Compile(Projection).Check({ items: [], remaining: 12 })).toBe(true)
        expect(Projection.required).toEqual(['items', 'remaining'])
    })

    it('rejects malformed visibility metadata instead of treating it as public', () => {
        const Canonical = Type.Object({
            secret: Type.Number({
                [Visibility.MetadataKey]: {
                    policy: 'example.secret',
                    redaction: { kind: 'unknown' }
                }
            })
        })

        expect(() => Visibility.createProjectionSchema(Canonical)).toThrow(
            `Invalid ${Visibility.MetadataKey} declaration`
        )
    })
})
