import AjvCompiler from '@fastify/ajv-compiler'
import { describe, expect, it } from 'vitest'
import { Type } from 'typebox'
import { actionRequestSchema, createGameRequestSchema, GameAction } from '@tabletop/common'
import type { GameDefinition } from '@tabletop/common'
import { ajvOptions } from './ajvOptions.js'
import { TitleValidation } from './titleValidation.js'

// The title routes validated with Fastify's AJV before TypeBox; these cases pin the wire
// contract the switch preserved: coercion, defaults, dates and the shape of a rejection.
const Config = Type.Object({ rounds: Type.Integer({ default: 3 }) })
const definition = {
    info: { id: 'test', metadata: { version: '1.0.0' }, configurator: { schema: Config } },
    runtime: { apiActions: { test: GameAction } }
} as unknown as GameDefinition

const ajvValidator = (schema: unknown, removeAdditional: boolean) =>
    AjvCompiler()(
        {},
        { ...ajvOptions, customOptions: { ...ajvOptions.customOptions, removeAdditional } }
    )({ schema, method: 'POST', url: '/', httpPart: 'body' })

describe('title request validation', () => {
    const validation = new TitleValidation()
    const valid = {
        gameId: 42,
        action: { id: 123, gameId: 42, source: 'user', type: 'test', index: '2' }
    }
    const actionCases = [
        valid,
        {},
        { ...valid, extra: true },
        { ...valid, action: { ...valid.action, createdAt: 'bad' } },
        { ...valid, action: { ...valid.action, createdAt: '2026-10-20T00:00:00Z' } },
        { ...valid, action: { ...valid.action, unknown: 1 } }
    ]

    it.each(actionCases.map((body, index) => [index, body]))(
        'accepts and coerces an action body exactly as AJV did (case %i)',
        (_index, body) => {
            const reference = ajvValidator(actionRequestSchema(GameAction), false)
            const expected = structuredClone(body)
            const accepted = reference(expected)
            let actual: unknown
            let rejected: { statusCode: number; code: string; validation: unknown[] } | undefined
            try {
                actual = validation.request(definition, 'action:test', structuredClone(body))
            } catch (error) {
                rejected = error as typeof rejected
            }
            expect(rejected === undefined).toBe(accepted)
            if (rejected) {
                expect(rejected.statusCode).toBe(400)
                expect(rejected.code).toBe('FST_ERR_VALIDATION')
                expect(rejected.validation.length).toBeGreaterThan(0)
            } else {
                expect(actual).toEqual(expected)
            }
        }
    )

    it('coerces in place, so the handler reads the coerced body', () => {
        const body = structuredClone(valid)
        expect(validation.request(definition, 'action:test', body)).toBe(body)
        expect(body.gameId).toBe('42')
        expect(body.action.index).toBe(2)
    })

    it('rejects an unknown action with a 404', () => {
        expect(() => validation.request(definition, 'action:missing', valid)).toThrow(
            expect.objectContaining({ statusCode: 404 })
        )
    })

    it('strips unnamed properties from a create body and applies defaults, as AJV did', () => {
        const body = {
            game: { id: 'g', name: 'n', players: [], isPublic: 'true', config: {} },
            extra: true
        }
        const reference = ajvValidator(createGameRequestSchema(Config), true)
        const expected = structuredClone(body)
        expect(reference(expected)).toBe(true)
        const actual = validation.request(definition, 'create', structuredClone(body))
        expect(actual).toEqual(expected)
        expect((actual as typeof body).game.config).toEqual({ rounds: 3 })
        expect('extra' in (actual as object)).toBe(false)
    })

    it('compiles each action validator once per Definition', () => {
        const first = validation.action(definition, 'test')
        expect(validation.action(definition, 'test')).toBe(first)
        expect(validation.action(definition, 'missing')).toBeUndefined()
        const other = { ...definition, runtime: { apiActions: { test: GameAction } } }
        expect(validation.action(other, 'test')).not.toBe(first)
    })
})
