import * as Type from 'typebox'
import { Compile, type Validator } from 'typebox/compile'

export const PreferenceValues = Type.Record(Type.String(), Type.Unknown())
export type PreferenceValues = Type.Static<typeof PreferenceValues>
export const PreferenceRecord = Type.Object({
    version: Type.Integer({ minimum: 1 }),
    revision: Type.Integer({ minimum: 0 }),
    values: PreferenceValues
})
export type PreferenceRecord = Type.Static<typeof PreferenceRecord>
export const TitlePreferenceData = Type.Object({
    title: PreferenceRecord,
    family: Type.Optional(PreferenceRecord)
})
export type TitlePreferenceData = Type.Static<typeof TitlePreferenceData>
export const PreferenceChange = Type.Object(
    {
        scope: Type.Union([Type.Literal('title'), Type.Literal('family')]),
        version: Type.Integer({ minimum: 1 }),
        set: PreferenceValues,
        unset: Type.Array(Type.String(), { uniqueItems: true })
    },
    { additionalProperties: false }
)
export type PreferenceChange = Type.Static<typeof PreferenceChange>
export type PreferenceResponse = { data: TitlePreferenceData; etag: string }
export type PreferenceDefinition<T extends Type.TObject = Type.TObject> = {
    schema: T
    defaults: Type.Static<T>
    version: number
    migrations?: Readonly<Record<number, (values: PreferenceValues) => PreferenceValues>>
}
export type TitlePreferenceDefinition<T extends Type.TObject = Type.TObject> = {
    title: PreferenceDefinition<T>
    family?: PreferenceDefinition & { id: string }
}

export class PreferenceError extends Error {
    constructor(
        message: string,
        readonly status: number = 400
    ) {
        super(message)
        this.name = 'PreferenceError'
    }
}

export function migratePreferences(
    definition: PreferenceDefinition,
    record: PreferenceRecord
): PreferenceValues {
    if (record.version > definition.version)
        throw new PreferenceError('Preferences require a newer title version', 409)
    let values = structuredClone(record.values)
    for (let version = record.version; version < definition.version; version++) {
        const migrate = definition.migrations?.[version]
        if (!migrate) throw new PreferenceError('Preference migration is unavailable', 409)
        values = migrate(values)
    }
    return values
}

const choiceValidators = new WeakMap<Type.TObject, ReadonlyMap<string, Validator>>()

function acceptsChoice(schema: Type.TObject, key: string, value: unknown): boolean {
    let validators = choiceValidators.get(schema)
    if (!validators) {
        validators = new Map(
            Object.entries(schema.properties).map(([name, property]) => [name, Compile(property)])
        )
        choiceValidators.set(schema, validators)
    }
    return validators.get(key)?.Check(value) ?? false
}

/**
 * Each choice from the title record, else the family record, else the default. Titles release
 * independently and read the shared family record with their own schema, so a stored value this
 * schema doesn't accept falls back for that choice alone instead of failing the record.
 */
export function resolvePreferences<T extends Type.TObject>(
    definition: TitlePreferenceDefinition<T>,
    data: TitlePreferenceData
): Type.Static<T> {
    const schema = definition.title.schema
    const layers = [
        migratePreferences(definition.title, data.title),
        definition.family && data.family ? migratePreferences(definition.family, data.family) : {}
    ]
    const defaults: PreferenceValues = { ...definition.title.defaults }
    const known = Object.fromEntries(
        Object.keys(schema.properties).flatMap((key) => {
            const stored = layers.find(
                (layer) => Object.hasOwn(layer, key) && acceptsChoice(schema, key, layer[key])
            )
            if (stored) return [[key, stored[key]]]
            return Object.hasOwn(defaults, key) ? [[key, defaults[key]]] : []
        })
    )
    if (!Compile(schema).Check(known)) throw new PreferenceError('Preference defaults are invalid')
    return known
}

export function changePreferences(
    definition: PreferenceDefinition,
    record: PreferenceRecord,
    change: PreferenceChange
): PreferenceRecord {
    if (change.version !== definition.version)
        throw new PreferenceError('Preference schema version changed', 409)
    const knownKeys = Object.keys(definition.schema.properties)
    if (
        [...Object.keys(change.set), ...change.unset].some(
            (key) =>
                !knownKeys.includes(key) || ['__proto__', 'constructor', 'prototype'].includes(key)
        )
    )
        throw new PreferenceError('Unknown preference')
    const partial = Compile(Type.Partial(definition.schema, { additionalProperties: false }))
    if (!partial.Check(change.set)) throw new PreferenceError('Invalid preference value')
    // Stored values this schema doesn't accept stay for the titles that do; reads skip them.
    const values = { ...migratePreferences(definition, record), ...change.set }
    for (const key of change.unset) delete values[key]
    return { version: definition.version, revision: record.revision + 1, values }
}
