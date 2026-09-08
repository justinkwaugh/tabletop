import * as Type from 'typebox'
import { describe, expect, expectTypeOf, it, vi } from 'vitest'
import * as Visibility from './index.js'

const spectator = { kind: 'spectator' } as const
const owner = { kind: 'player', playerId: 'p1' } as const
const policy = Visibility.Policy.anyOf(
    Visibility.Policy.Owner,
    Visibility.Policy.configEquals('hiddenMoney', false, { defaultValue: false }),
    Visibility.Policy.stateEquals('machineState', 'finished')
)
const State = Type.Object({
    machineState: Type.String(),
    players: Type.Array(
        Type.Object({
            playerId: Type.String(),
            money: Visibility.protect(Type.Number(), { policy })
        })
    )
})
const state = { machineState: 'playing', players: [{ playerId: 'p1', money: 12 }] }
const projector = Visibility.createProjector(State)

describe('declarative visibility policies', () => {
    it.each([
        { hiddenMoney: false, perspective: spectator, phase: 'playing', visible: true },
        { hiddenMoney: true, perspective: spectator, phase: 'playing', visible: false },
        { hiddenMoney: true, perspective: owner, phase: 'playing', visible: true },
        { hiddenMoney: true, perspective: spectator, phase: 'finished', visible: true }
    ])(
        'uses the same decision for projection and execution: %j',
        ({ hiddenMoney, perspective, phase, visible }) => {
            const context = { config: { hiddenMoney } }
            const projected = projector.project(
                { ...state, machineState: phase },
                perspective,
                context
            )
            expectTypeOf(projected).toEqualTypeOf<{
                machineState: string
                players: { playerId: string; money?: number }[]
            }>()
            expect(Object.hasOwn(projected.players[0], 'money')).toBe(visible)
            const guarded = projector.guardForExecution(projected, perspective, context)
            if (visible) expect(guarded.players[0].money).toBe(12)
            else
                expect(() => guarded.players[0].money).toThrow(
                    Visibility.UnavailableProjectedValueError
                )
        }
    )

    it('requires Game context even when a config condition has a default', () => {
        expect(() => projector.project(state, owner)).toThrow('requires Game configuration')
        expect(() => projector.guardForExecution(state, owner)).toThrow(
            'requires Game configuration'
        )
        expect(projector.project(state, spectator, { config: {} })).toEqual(state)
    })

    it('does not treat an absent option as false without an explicit default', () => {
        const required = Visibility.createProjector(
            Type.Object({
                money: Visibility.protect(Type.Number(), {
                    policy: Visibility.Policy.configEquals('hiddenMoney', false)
                })
            })
        )
        expect(() => required.project({ money: 12 }, spectator, { config: {} })).toThrow(
            'requires config option'
        )
        const guarded = required.guardForExecution({ money: 12 }, spectator, { config: {} })
        expect(() => guarded.money).toThrow()
    })

    it('takes a fresh immutable configuration snapshot for each call', () => {
        const config = { hiddenMoney: false }
        const guarded = projector.guardForExecution(state, spectator, { config })
        config.hiddenMoney = true
        expect(guarded.players[0].money).toBe(12)
        expect(projector.project(state, spectator, { config }).players[0]).not.toHaveProperty(
            'money'
        )
        expect(projector.project(state, spectator, { config: { hiddenMoney: false } })).toEqual(
            state
        )
    })

    it('uses each projected position to decide disclosure', () => {
        const context = { config: { hiddenMoney: true } }
        expect(
            projector.project({ ...state, machineState: 'finished' }, spectator, context).players[0]
                .money
        ).toBe(12)
        expect(projector.project(state, spectator, context).players[0]).not.toHaveProperty('money')
    })

    it('does not authorize withheld values when local execution changes the disclosure phase', () => {
        const conditional = Visibility.createProjector(
            Type.Object({
                machineState: Type.String(),
                secret: Visibility.protect(Type.Array(Type.Number()), {
                    policy: Visibility.Policy.stateEquals('machineState', 'finished'),
                    redaction: Visibility.redaction.emptyArray()
                })
            })
        )
        const projected = conditional.project({ machineState: 'playing', secret: [12] }, spectator)
        const guarded = conditional.guardForExecution(projected, spectator)
        guarded.machineState = 'finished'
        expect(() => guarded.secret).toThrow(Visibility.UnavailableProjectedValueError)
        const disclosed = conditional.project({ machineState: 'finished', secret: [12] }, spectator)
        expect(conditional.guardForExecution(disclosed, spectator).secret).toEqual([12])
    })

    it('rejects conditions based on protected or undeclared fields', () => {
        for (const field of ['secret', 'missing']) {
            expect(() =>
                Visibility.createProjector(
                    Type.Object({
                        secret: Visibility.protect(Type.String(), {
                            policy: Visibility.Policy.HostOnly
                        }),
                        money: Visibility.protect(Type.Number(), {
                            policy: Visibility.Policy.stateEquals(field, 'finished')
                        })
                    })
                )
            ).toThrow('unconditionally public field')
        }
    })

    it('requires the condition field to be public in every union branch', () => {
        expect(() =>
            Visibility.createProjector(
                Type.Union([
                    State,
                    Type.Object({
                        ...State.properties,
                        machineState: Visibility.protect(Type.String(), {
                            policy: Visibility.Policy.HostOnly
                        })
                    })
                ])
            )
        ).toThrow('unconditionally public field')
    })

    it('allows custom callbacks for projection but never uses them to authorize execution', () => {
        const custom = vi.fn(() => true)
        const conditional = Visibility.createProjector(
            Type.Object({
                playerId: Type.String(),
                money: Visibility.protect(Type.Number(), {
                    policy: Visibility.Policy.anyOf('custom', Visibility.Policy.Owner)
                })
            }),
            { policies: { custom } }
        )
        const projected = conditional.project({ playerId: 'p1', money: 12 }, spectator)
        expect(projected.money).toBe(12)
        custom.mockClear()
        expect(() => conditional.guardForExecution(projected, spectator).money).toThrow(
            Visibility.UnavailableProjectedValueError
        )
        expect(conditional.guardForExecution(projected, owner).money).toBe(12)
        expect(custom).not.toHaveBeenCalled()
    })

    it('validates custom names nested in conditional policies', () => {
        expect(() =>
            Visibility.createProjector(
                Type.Object({
                    money: Visibility.protect(Type.Number(), {
                        policy: Visibility.Policy.anyOf(Visibility.Policy.Public, 'missing-policy')
                    })
                })
            )
        ).toThrow('No visibility policy registered')
    })

    it('keeps existing string policies callable without context', () => {
        const publicProjector = Visibility.createProjector(
            Type.Object({
                money: Visibility.protect(Type.Number(), { policy: Visibility.Policy.Public })
            })
        )
        expect(publicProjector.project({ money: 12 }, spectator)).toEqual({ money: 12 })
        expect(publicProjector.guardForExecution({ money: 12 }, spectator).money).toBe(12)
    })
})
