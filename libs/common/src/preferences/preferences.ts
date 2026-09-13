import * as Type from 'typebox'
import { Compile } from 'typebox/compile'

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

export function resolvePreferences<T extends Type.TObject>(
    definition: TitlePreferenceDefinition<T>,
    data: TitlePreferenceData
): Type.Static<T> {
    const values = {
        ...definition.title.defaults,
        ...(definition.family && data.family
            ? migratePreferences(definition.family, data.family)
            : {}),
        ...migratePreferences(definition.title, data.title)
    }
    const known = Object.fromEntries(
        Object.keys(definition.title.schema.properties)
            .filter((key) => Object.hasOwn(values, key))
            .map((key) => [key, values[key]])
    )
    const validator = Compile(definition.title.schema)
    if (!validator.Check(known)) throw new PreferenceError('Stored preferences are invalid')
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
    const values = { ...migratePreferences(definition, record), ...change.set }
    for (const key of change.unset) delete values[key]
    const resolved = Object.fromEntries(
        knownKeys.map((key) => [
            key,
            Object.hasOwn(values, key) ? values[key] : definition.defaults[key]
        ])
    )
    if (!Compile(definition.schema).Check(resolved))
        throw new PreferenceError('Invalid preference combination')
    return { version: definition.version, revision: record.revision + 1, values }
}
