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

    it('shows actor-protected fields only to the Player attributed by the root value', () => {
        const Action = Type.Object({
            playerId: Type.String(),
            publicValue: Type.String(),
            privateValue: Visibility.protect(Type.Number(), {
                policy: Visibility.Policy.Actor
            })
        })
        const canonical = {
            playerId: 'player-1',
            publicValue: 'submitted',
            privateValue: 42
        }
        const projector = Visibility.createProjector(Action)

        const actorProjection = projector.project(canonical, playerPerspective)
        const opponentProjection = projector.project(canonical, {
            kind: 'player',
            playerId: 'player-2'
        })
        const spectatorProjection = projector.project(canonical, spectatorPerspective)

        expect(actorProjection).toEqual(canonical)
        expect(opponentProjection).toEqual({
            playerId: 'player-1',
            publicValue: 'submitted'
        })
        expect(spectatorProjection).toEqual(opponentProjection)
        expect(Compile(projector.schema).Check(actorProjection)).toBe(true)
        expect(Compile(projector.schema).Check(opponentProjection)).toBe(true)
        expect(Compile(projector.schema).Check(spectatorProjection)).toBe(true)
    })

    it('fails closed when the Actor policy has no root player attribution', () => {
        const InvalidRoot = Type.Object({
            privateValue: Visibility.protect(Type.Number(), {
                policy: Visibility.Policy.Actor
            })
        })
        const projector = Visibility.createProjector(InvalidRoot)

        expect(() => projector.project({ privateValue: 42 }, playerPerspective)).toThrow(
            'The "tabletop.actor" visibility policy requires the projected root value to have a playerId'
        )
    })

    it('evaluates named policies with traversal context and projects authorized values recursively', () => {
        const OwnerPolicy = 'example.owner'
        const Canonical = Type.Object({
            label: Type.String(),
            entries: Type.Array(
                Type.Object({
                    ownerId: Type.String(),
                    payload: Visibility.protect(
                        Type.Object({
                            visibleToOwner: Type.String(),
                            hostOnly: Visibility.protect(Type.String(), {
                                policy: Visibility.Policy.HostOnly
                            })
                        }),
                        { policy: OwnerPolicy }
                    )
                })
            )
        })
        const canonical = {
            label: 'collection',
            entries: [
                {
                    ownerId: 'player-1',
                    payload: { visibleToOwner: 'first', hostOnly: 'first-host-value' }
                },
                {
                    ownerId: 'player-2',
                    payload: { visibleToOwner: 'second', hostOnly: 'second-host-value' }
                }
            ]
        }
        const contexts: Visibility.PolicyContext<typeof canonical>[] = []
        const policies: Visibility.PolicyRegistry<typeof canonical> = {
            [OwnerPolicy]: (context) => {
                contexts.push(context)
                const parent = context.parent
                return (
                    context.perspective.kind === 'player' &&
                    typeof parent === 'object' &&
                    parent !== null &&
                    'ownerId' in parent &&
                    parent.ownerId === context.perspective.playerId
                )
            }
        }
        const projector = Visibility.createProjector(Canonical, { policies })

        const playerProjection = projector.project(canonical, playerPerspective)

        expect(playerProjection).toEqual({
            label: 'collection',
            entries: [
                { ownerId: 'player-1', payload: { visibleToOwner: 'first' } },
                { ownerId: 'player-2' }
            ]
        })
        expect(contexts.map(({ path }) => path)).toEqual([
            ['entries', 0, 'payload'],
            ['entries', 1, 'payload']
        ])
        expect(contexts[0].root).toBe(canonical)
        expect(contexts[0].parent).toBe(canonical.entries[0])
        expect(contexts[0].value).toBe(canonical.entries[0].payload)

        contexts.length = 0
        const spectatorProjection = projector.project(canonical, spectatorPerspective)

        expect(spectatorProjection).toEqual({
            label: 'collection',
            entries: [{ ownerId: 'player-1' }, { ownerId: 'player-2' }]
        })
        expect(contexts).toHaveLength(2)
        expect(canonical.entries[0].payload.hostOnly).toBe('first-host-value')
        expect(Compile(projector.schema).Check(playerProjection)).toBe(true)
        expect(Compile(projector.schema).Check(spectatorProjection)).toBe(true)
    })

    it('resolves the nearest schema-declared scope for a named policy', () => {
        const ScopedSecretPolicy = 'example.scoped-secret'
        const Container = Visibility.scope(
            Type.Object({
                ownerId: Type.String(),
                entries: Type.Array(
                    Type.Object({
                        secret: Visibility.protect(Type.Number(), {
                            policy: ScopedSecretPolicy
                        })
                    })
                )
            }),
            'example.container'
        )
        const Canonical = Type.Object({
            containers: Type.Array(Container)
        })
        const canonical = {
            containers: [
                { ownerId: 'player-1', entries: [{ secret: 11 }] },
                { ownerId: 'player-2', entries: [{ secret: 22 }] }
            ]
        }
        const resolvedOwnerIds: string[] = []
        const policies: Visibility.PolicyRegistry<typeof canonical> = {
            [ScopedSecretPolicy]: (context) => {
                const container = context.requireScope(Container)
                resolvedOwnerIds.push(container.ownerId)
                return (
                    context.perspective.kind === 'player' &&
                    context.perspective.playerId === container.ownerId
                )
            }
        }
        const projector = Visibility.createProjector(Canonical, { policies })

        expect(projector.project(canonical, playerPerspective)).toEqual({
            containers: [
                { ownerId: 'player-1', entries: [{ secret: 11 }] },
                { ownerId: 'player-2', entries: [{}] }
            ]
        })
        expect(resolvedOwnerIds).toEqual(['player-1', 'player-2'])
    })

    it('fails closed when a policy requires a scope that does not enclose its value', () => {
        const ScopedSecretPolicy = 'example.missing-scope'
        const ExpectedScope = Visibility.scope(
            Type.Object({ id: Type.String() }),
            'example.expected-scope'
        )
        const Canonical = Type.Object({
            secret: Visibility.protect(Type.Number(), { policy: ScopedSecretPolicy })
        })
        const projector = Visibility.createProjector(Canonical, {
            policies: {
                [ScopedSecretPolicy]: (context) => {
                    context.requireScope(ExpectedScope)
                    return true
                }
            }
        })

        expect(() => projector.project({ secret: 42 }, playerPerspective)).toThrow(
            'No enclosing visibility scope found for "example.expected-scope"'
        )
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
