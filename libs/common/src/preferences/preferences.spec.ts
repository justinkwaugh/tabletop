import { describe, expect, it } from 'vitest'
import * as Type from 'typebox'
import {
    changePreferences,
    resolvePreferences,
    type TitlePreferenceDefinition
} from './preferences.js'

const schema = Type.Object(
    { display: Type.Union([Type.Literal('full'), Type.Literal('small')]), sound: Type.Boolean() },
    { additionalProperties: false }
)
const definition = {
    title: { schema, defaults: { display: 'full', sound: true }, version: 1 },
    family: { id: 'family', schema, defaults: { display: 'full', sound: true }, version: 1 }
} satisfies TitlePreferenceDefinition<typeof schema>
const empty = { version: 1, revision: 0, values: {} }

describe('explicit user preferences', () => {
    it('inherits family choices, lets title choices override them, and restores inheritance on unset', () => {
        const family = changePreferences(definition.family, empty, {
            scope: 'family',
            version: 1,
            set: { display: 'small' },
            unset: []
        })
        const title = changePreferences(definition.title, empty, {
            scope: 'title',
            version: 1,
            set: { display: 'full' },
            unset: []
        })
        expect(resolvePreferences(definition, { family, title })).toEqual({
            display: 'full',
            sound: true
        })
        const reset = changePreferences(definition.title, title, {
            scope: 'title',
            version: 1,
            set: {},
            unset: ['display']
        })
        expect(reset.values).toEqual({})
        expect(resolvePreferences(definition, { family, title: reset })).toEqual({
            display: 'small',
            sound: true
        })
        expect(family.values).toEqual({ display: 'small' })
    })
    it('rejects invalid, unknown and stale-version writes', () => {
        for (const set of [{ display: 'huge' }, { unknown: true }]) {
            expect(() =>
                changePreferences(definition.title, empty, {
                    scope: 'title',
                    version: 1,
                    set,
                    unset: []
                })
            ).toThrow()
        }
        expect(() =>
            changePreferences(definition.title, empty, {
                scope: 'title',
                version: 2,
                set: {},
                unset: []
            })
        ).toThrow()
    })
    it('migrates explicit choices without persisting defaults or losing unrelated keys', () => {
        const migrated = {
            ...definition.title,
            version: 2,
            migrations: {
                1: (values: Record<string, unknown>) => ({
                    ...values,
                    display: values.display === 'compact' ? 'small' : values.display
                })
            }
        }
        const record = {
            version: 1,
            revision: 2,
            values: { display: 'compact', future: 'preserved' }
        }
        const changed = changePreferences(migrated, record, {
            scope: 'title',
            version: 2,
            set: { sound: false },
            unset: []
        })
        expect(changed).toEqual({
            version: 2,
            revision: 3,
            values: { display: 'small', future: 'preserved', sound: false }
        })
        expect(record.values.display).toBe('compact')
    })
})
