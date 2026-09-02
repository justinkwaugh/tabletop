import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { describe, expect, expectTypeOf, it } from 'vitest'
import { DrawBag } from '../components/drawBag.js'
import * as Visibility from './index.js'

const playerPerspective: Visibility.Perspective = { kind: 'player', playerId: 'player-1' }
const spectatorPerspective: Visibility.Perspective = { kind: 'spectator' }

describe('visibility value projection', () => {
    it('omits protected fields and copies only schema-declared public fields', () => {
        const Canonical = Type.Object({
            publicValue: Type.String(),
            nested: Type.Object({
                entries: Type.Array(
                    Type.Object({
                        id: Type.String(),
                        secret: Visibility.protect(Type.Number(), {
                            policy: Visibility.Policy.HostOnly
                        })
                    })
                )
            })
        })
        const canonical = {
            publicValue: 'visible',
            nested: { entries: [{ id: 'entry-1', secret: 42 }] },
            undeclared: 'not part of the projection'
        }

        const projector = Visibility.createProjector(Canonical)
        const projected = projector.project(canonical, playerPerspective)

        expect(projected).toEqual({
            publicValue: 'visible',
            nested: { entries: [{ id: 'entry-1' }] }
        })
        expect(canonical).toEqual({
            publicValue: 'visible',
            nested: { entries: [{ id: 'entry-1', secret: 42 }] },
            undeclared: 'not part of the projection'
        })
        expect(Compile(projector.schema).Check(projected)).toBe(true)
        expectTypeOf(projected).toEqualTypeOf<{
            publicValue: string
            nested: { entries: { id: string; secret?: number }[] }
        }>()
    })

    it('executes the built-in empty-array redaction without mutating the canonical bag', () => {
        const Canonical = DrawBag(Type.String())
        const canonical = { items: ['first', 'second'], remaining: 2 }

        const projector = Visibility.createProjector(Canonical)
        const playerProjection = projector.project(canonical, playerPerspective)
        const spectatorProjection = projector.project(canonical, spectatorPerspective)

        expect(playerProjection).toEqual({ items: [], remaining: 2 })
        expect(spectatorProjection).toEqual(playerProjection)
        expect(playerProjection).not.toBe(canonical)
        expect(canonical).toEqual({ items: ['first', 'second'], remaining: 2 })
        expect(Compile(projector.schema).Check(playerProjection)).toBe(true)
        expect(Compile(projector.schema).Check(spectatorProjection)).toBe(true)
    })

    it('projects through intersections and the matching branch of a union', () => {
        const Entry = Type.Union([
            Type.Object({ kind: Type.Literal('public'), label: Type.String() }),
            Type.Object({
                kind: Type.Literal('secret'),
                label: Type.String(),
                code: Visibility.protect(Type.String(), {
                    policy: Visibility.Policy.HostOnly
                })
            })
        ])
        const Canonical = Type.Intersect([
            Type.Object({ id: Type.String() }),
            Type.Object({ entries: Type.Array(Entry) })
        ])

        const projector = Visibility.createProjector(Canonical)
        const projected = projector.project(
            {
                id: 'collection-1',
                entries: [
                    { kind: 'public', label: 'Public entry' },
                    { kind: 'secret', label: 'Protected entry', code: 'hidden' }
                ]
            },
            spectatorPerspective
        )

        expect(projected).toEqual({
            id: 'collection-1',
            entries: [
                { kind: 'public', label: 'Public entry' },
                { kind: 'secret', label: 'Protected entry' }
            ]
        })
        expect(Compile(projector.schema).Check(projected)).toBe(true)
    })

    it('fails closed when a named policy or redaction Adapter has no implementation', () => {
        const UnknownPolicy = Type.Object({
            secret: Visibility.protect(Type.String(), { policy: 'example.unknown' })
        })
        const UnknownAdapter = Type.Object({
            secret: Visibility.protect(Type.String(), {
                policy: Visibility.Policy.HostOnly,
                redaction: Visibility.redaction.replaceWith('example.unknown', Type.Boolean())
            })
        })

        expect(() => Visibility.createProjector(UnknownPolicy)).toThrow(
            'No visibility policy registered for "example.unknown"'
        )
        expect(() => Visibility.createProjector(UnknownAdapter)).toThrow(
            'No visibility redaction Adapter registered for "example.unknown"'
        )
    })
})
