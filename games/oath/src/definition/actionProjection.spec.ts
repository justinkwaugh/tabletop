import { describe, expect, it } from 'vitest'
import type * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { Visibility } from '@tabletop/common'
import { OathVisibility } from './runtime.js'
import { OathApiActions } from './apiActions.js'

// R-9.4 — a record of every action type, with every optional field present, reaches no other seat's secret.
const ACTOR = 'p1'
const SHOWN = 'p3'
const perspectives = [
    { kind: 'player', playerId: 'p2' },
    { kind: 'spectator' }
] as const satisfies readonly Visibility.Perspective[]

interface Sampling {
    /** Which variant of every union this sample takes; sampling each index covers every variant. */
    variant: number
    secrets: number
}

function schemaOf(value: unknown): Type.TSchema {
    if (typeof value !== 'object' || value === null) throw Error('Not a schema')
    return value
}

function propertyOf(schema: Type.TSchema, key: string): unknown {
    return Reflect.get(schema, key)
}

/** A value for `schema`; strings under a protected field are secrets, and player ids are real seats. */
function sample(schema: Type.TSchema, sampling: Sampling, key: string, secret: boolean): unknown {
    const isSecret = secret || Reflect.has(schema, Visibility.MetadataKey)
    const constant = propertyOf(schema, 'const')
    if (constant !== undefined) return constant
    const choices = propertyOf(schema, 'enum')
    if (Array.isArray(choices)) return choices[sampling.variant % choices.length]
    const anyOf = propertyOf(schema, 'anyOf')
    if (Array.isArray(anyOf))
        return sample(schemaOf(anyOf[sampling.variant % anyOf.length]), sampling, key, isSecret)
    const allOf = propertyOf(schema, 'allOf')
    if (Array.isArray(allOf))
        return Object.assign({}, ...allOf.map((part) => sample(schemaOf(part), sampling, key, isSecret)))
    switch (propertyOf(schema, 'type')) {
        case 'object': {
            const properties = propertyOf(schema, 'properties')
            const patterns = propertyOf(schema, 'patternProperties')
            if (typeof properties === 'object' && properties !== null)
                return Object.fromEntries(
                    Object.entries(properties).map(([name, child]) => [
                        name,
                        sample(schemaOf(child), sampling, name, isSecret)
                    ])
                )
            if (typeof patterns === 'object' && patterns !== null) {
                const [child] = Object.values(patterns)
                return { [isSecret ? `k${sampling.secrets}` : 'key']: sample(schemaOf(child), sampling, key, isSecret) }
            }
            return {}
        }
        case 'array': {
            const items = schemaOf(propertyOf(schema, 'items'))
            return [sample(items, sampling, key, isSecret)]
        }
        case 'string':
            if (/playerid$/i.test(key)) return key === 'toPlayerId' ? SHOWN : ACTOR
            if (key === 'shownTo') return SHOWN
            if (!isSecret) return 'public'
            sampling.secrets += 1
            return `secret.card-${sampling.secrets}`
        case 'number':
        case 'integer':
            return 1
        case 'boolean':
            return true
        case 'null':
            return null
        default:
            return 'public'
    }
}

function variantCount(schema: unknown, seen = new Set<unknown>()): number {
    if (typeof schema !== 'object' || schema === null || seen.has(schema)) return 1
    seen.add(schema)
    const own = [propertyOf(schemaOf(schema), 'anyOf'), propertyOf(schemaOf(schema), 'enum')]
        .filter(Array.isArray)
        .map((list) => list.length)
    const children = Object.values(schema).flatMap((child) =>
        Array.isArray(child) ? child.map((item) => variantCount(item, seen)) : [variantCount(child, seen)]
    )
    return Math.max(1, ...own, ...children)
}

function recordOf(schema: Type.TSchema, type: string, sampling: Sampling) {
    const createdAt = new Date(0)
    return { ...Object(sample(schema, sampling, '', false)), type, playerId: ACTOR, createdAt, updatedAt: createdAt }
}

describe('every registered action type projects without naming a secret to another seat', () => {
    for (const [type, schema] of Object.entries(OathApiActions)) {
        it(type, () => {
            const validator = Compile(schema)
            for (let variant = 0; variant < variantCount(schema); variant++) {
                const sampling: Sampling = { variant, secrets: 0 }
                const record = recordOf(schema, type, sampling)
                if (!validator.Check(record)) continue
                expect(() => OathVisibility.actions.project(record, { kind: 'player', playerId: ACTOR })).not.toThrow()
                for (const perspective of perspectives) {
                    const json = JSON.stringify(OathVisibility.actions.project(record, perspective))
                    expect(json).not.toContain('secret.card-')
                }
            }
        })
    }

    it('keeps the secrets its actor is owed: a power use shows its peek to its user', () => {
        const schema = OathApiActions.useActionPower
        const record = recordOf(schema, 'useActionPower', { variant: 0, secrets: 0 })
        expect(Compile(schema).Check(record)).toBe(true)
        const own = JSON.stringify(OathVisibility.actions.project(record, { kind: 'player', playerId: ACTOR }))
        expect(own).toContain('secret.card-')
    })

    it('samples a valid record of every type', () => {
        const unsampled = Object.entries(OathApiActions).filter(([type, schema]) => {
            const validator = Compile(schema)
            return !Array.from({ length: variantCount(schema) }, (_, variant) => variant).some((variant) =>
                validator.Check(recordOf(schema, type, { variant, secrets: 0 }))
            )
        })
        expect(unsampled.map(([type]) => type)).toEqual([])
    })
})
