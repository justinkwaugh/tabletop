import * as Type from 'typebox'
import { Memory } from 'typebox/system'

export const MetadataKey = 'x-tabletop-visibility' as const
export const ScopeKey = 'x-tabletop-visibility-scope' as const

export const Policy = {
    Actor: 'tabletop.actor',
    HostOnly: 'tabletop.host-only'
} as const

export const EmptyArrayAdapter = 'tabletop.empty-array' as const

export interface OmitRedaction {
    kind: 'omit'
}

export interface ReplacementRedaction<
    Adapter extends string = string,
    Schema extends Type.TSchema = Type.TSchema
> {
    kind: 'replace'
    adapter: Adapter
    schema: Schema
}

export type Redaction = OmitRedaction | ReplacementRedaction

export interface Metadata<
    PolicyName extends string = string,
    RedactionType extends Redaction = Redaction
> {
    policy: PolicyName
    redaction: RedactionType
}

type VisibilityOptions<PolicyName extends string, RedactionType extends Redaction> = {
    [MetadataKey]: Metadata<PolicyName, RedactionType>
}

export interface ScopeMetadata<Name extends string = string> {
    [ScopeKey]: Name
}

export type ProtectedSchema<
    Schema extends Type.TSchema,
    PolicyName extends string = string,
    RedactionType extends Redaction = OmitRedaction
> = Type.TOptions<Schema, VisibilityOptions<PolicyName, RedactionType>>

export type ScopedSchema<Schema extends Type.TSchema, Name extends string = string> = Type.TOptions<
    Schema,
    ScopeMetadata<Name>
>

export interface ProtectionOptions<PolicyName extends string = string> {
    policy: PolicyName
}

const omitRedaction = (): OmitRedaction => ({ kind: 'omit' })

const replacementRedaction = <const Adapter extends string, Schema extends Type.TSchema>(
    adapter: Adapter,
    schema: Schema
): ReplacementRedaction<Adapter, Schema> => ({
    kind: 'replace',
    adapter,
    schema
})

export const redaction = {
    omit: omitRedaction,
    replaceWith: replacementRedaction,
    emptyArray: () => replacementRedaction(EmptyArrayAdapter, Type.Tuple([]))
}

export function scope<Schema extends Type.TSchema, const Name extends string>(
    schema: Schema,
    name: Name
): ScopedSchema<Schema, Name>
export function scope(schema: Type.TSchema, name: string): Type.TSchema
export function scope(schema: Type.TSchema, name: string): Type.TSchema {
    return Type.Options(schema, { [ScopeKey]: name })
}

export function protect<
    Schema extends Type.TSchema,
    const PolicyName extends string,
    RedactionType extends Redaction
>(
    schema: Schema,
    options: ProtectionOptions<PolicyName> & { redaction: RedactionType }
): ProtectedSchema<Schema, PolicyName, RedactionType>
export function protect<Schema extends Type.TSchema, const PolicyName extends string>(
    schema: Schema,
    options: ProtectionOptions<PolicyName>
): ProtectedSchema<Schema, PolicyName>
export function protect(
    schema: Type.TSchema,
    options: ProtectionOptions & { redaction?: Redaction }
): Type.TSchema {
    return Type.Options(schema, {
        [MetadataKey]: {
            policy: options.policy,
            redaction: options.redaction ?? omitRedaction()
        }
    })
}

type ProjectedProperties<Properties extends Type.TProperties> = {
    [Key in keyof Properties]: ProjectedSchema<Properties[Key]>
}

type ProjectedSchemas<
    Schemas extends Type.TSchema[],
    Projected extends Type.TSchema[] = {
        [Index in keyof Schemas]: ProjectedSchema<Schemas[Index]>
    }
> = Projected

type ApplyImmutable<
    Schema extends Type.TSchema,
    Projected extends Type.TSchema
> = Schema extends Type.TImmutable ? Type.TImmutable<Projected> : Projected

type ApplyReadonly<
    Schema extends Type.TSchema,
    Projected extends Type.TSchema
> = Schema extends Type.TReadonly ? Type.TReadonly<Projected> : Projected

type ApplyOptional<
    Schema extends Type.TSchema,
    Projected extends Type.TSchema
> = Schema extends Type.TOptional ? Type.TOptional<Projected> : Projected

type ApplyScope<Schema extends Type.TSchema, Projected extends Type.TSchema> =
    Schema extends ScopeMetadata<infer Name extends string>
        ? Type.TOptions<Projected, ScopeMetadata<Name>>
        : Projected

type ApplyModifiers<Schema extends Type.TSchema, Projected extends Type.TSchema> = ApplyOptional<
    Schema,
    ApplyReadonly<Schema, ApplyImmutable<Schema, ApplyScope<Schema, Projected>>>
>

type ProjectedStructure<Schema extends Type.TSchema> =
    Schema extends Type.TArray<infer Items extends Type.TSchema>
        ? Type.TArray<ProjectedSchema<Items>>
        : Schema extends Type.TObject<infer Properties extends Type.TProperties>
          ? Type.TObject<ProjectedProperties<Properties>>
          : Schema extends Type.TRecord<infer Key extends string, infer Value extends Type.TSchema>
            ? Type.TRecord<Key, ProjectedSchema<Value>>
            : Schema extends Type.TTuple<infer Items extends Type.TSchema[]>
              ? Type.TTuple<ProjectedSchemas<Items>>
              : Schema extends Type.TUnion<infer Schemas extends Type.TSchema[]>
                ? Type.TUnion<ProjectedSchemas<Schemas>>
                : Schema extends Type.TIntersect<infer Schemas extends Type.TSchema[]>
                  ? Type.TIntersect<ProjectedSchemas<Schemas>>
                  : Schema extends Type.TCyclic<
                          infer Definitions extends Type.TProperties,
                          infer Reference extends string
                      >
                    ? Type.TCyclic<ProjectedProperties<Definitions>, Reference>
                    : Schema

type ProjectedValue<Schema extends Type.TSchema> = ApplyModifiers<
    Schema,
    ProjectedStructure<Schema>
>

type ProjectedProtectedSchema<
    Schema extends Type.TSchema,
    RedactionType extends Redaction
> = RedactionType extends OmitRedaction
    ? Type.TOptional<ProjectedValue<Schema>>
    : RedactionType extends ReplacementRedaction<string, infer Replacement extends Type.TSchema>
      ? ApplyModifiers<Schema, Type.TUnion<[ProjectedValue<Schema>, ProjectedSchema<Replacement>]>>
      : never

export type ProjectedSchema<Schema extends Type.TSchema> = Schema extends {
    [MetadataKey]: Metadata<string, infer RedactionType extends Redaction>
}
    ? ProjectedProtectedSchema<Schema, RedactionType>
    : ProjectedValue<Schema>

const singleSchemaKeywords = [
    'additionalItems',
    'additionalProperties',
    'contains',
    'contentSchema',
    'else',
    'if',
    'items',
    'not',
    'propertyNames',
    'then',
    'unevaluatedItems',
    'unevaluatedProperties'
] as const

const schemaArrayKeywords = ['allOf', 'anyOf', 'items', 'oneOf', 'prefixItems'] as const

const schemaRecordKeywords = [
    '$defs',
    'definitions',
    'dependencies',
    'dependentSchemas',
    'patternProperties',
    'properties'
] as const

function isObject(value: unknown): value is object {
    return typeof value === 'object' && value !== null
}

function projectSingleSchemaKeyword(schema: Type.TSchema, keyword: string) {
    const child: unknown = Reflect.get(schema, keyword)
    if (Type.IsSchema(child)) {
        Reflect.set(schema, keyword, projectSchema(child))
    }
}

function projectSchemaArrayKeyword(schema: Type.TSchema, keyword: string) {
    const children: unknown = Reflect.get(schema, keyword)
    if (!Array.isArray(children)) {
        return
    }
    Reflect.set(
        schema,
        keyword,
        children.map((child) => (Type.IsSchema(child) ? projectSchema(child) : child))
    )
}

function projectSchemaRecordKeyword(schema: Type.TSchema, keyword: string) {
    const children: unknown = Reflect.get(schema, keyword)
    if (!isObject(children)) {
        return
    }
    for (const key of Reflect.ownKeys(children)) {
        const child: unknown = Reflect.get(children, key)
        if (Type.IsSchema(child)) {
            Reflect.set(children, key, projectSchema(child))
        }
    }
}

function updateRequiredProperties(schema: Type.TSchema) {
    if (!Type.IsObject(schema)) {
        return
    }
    const required = Object.entries(schema.properties)
        .filter(([, property]) => !Type.IsOptional(property))
        .map(([key]) => key)

    Reflect.deleteProperty(schema, 'required')
    if (required.length > 0) {
        Reflect.set(schema, 'required', required)
    }
}

function projectSchemaChildren(schema: Type.TSchema): Type.TSchema {
    const projection = Memory.Clone(schema)
    for (const keyword of singleSchemaKeywords) {
        projectSingleSchemaKeyword(projection, keyword)
    }
    for (const keyword of schemaArrayKeywords) {
        projectSchemaArrayKeyword(projection, keyword)
    }
    for (const keyword of schemaRecordKeywords) {
        projectSchemaRecordKeyword(projection, keyword)
    }
    updateRequiredProperties(projection)
    return projection
}

function isVisibilityRedaction(value: unknown): value is Redaction {
    if (!isObject(value)) {
        return false
    }
    const kind: unknown = Reflect.get(value, 'kind')
    if (kind === 'omit') {
        return true
    }
    return (
        kind === 'replace' &&
        typeof Reflect.get(value, 'adapter') === 'string' &&
        Type.IsSchema(Reflect.get(value, 'schema'))
    )
}

export function getScopeName(schema: Type.TSchema): string | undefined {
    if (!Reflect.has(schema, ScopeKey)) {
        return undefined
    }
    const name: unknown = Reflect.get(schema, ScopeKey)
    if (typeof name !== 'string') {
        throw Error(`Invalid ${ScopeKey} declaration`)
    }
    return name
}

export function getVisibilityMetadata(schema: Type.TSchema): Metadata | undefined {
    if (!Reflect.has(schema, MetadataKey)) {
        return undefined
    }
    const metadata: unknown = Reflect.get(schema, MetadataKey)
    if (!isObject(metadata)) {
        throw Error(`Invalid ${MetadataKey} declaration`)
    }
    const policy: unknown = Reflect.get(metadata, 'policy')
    const redaction: unknown = Reflect.get(metadata, 'redaction')
    if (typeof policy !== 'string' || !isVisibilityRedaction(redaction)) {
        throw Error(`Invalid ${MetadataKey} declaration`)
    }
    return {
        policy,
        redaction
    }
}

export function visitVisibilityMetadata(
    schema: Type.TSchema,
    visitor: (metadata: Metadata) => void
) {
    const visited = new Set<Type.TSchema>()

    function visit(current: Type.TSchema) {
        if (visited.has(current)) {
            return
        }
        visited.add(current)

        const metadata = getVisibilityMetadata(current)
        if (metadata !== undefined) {
            visitor(metadata)
            if (metadata.redaction.kind === 'replace') {
                visit(metadata.redaction.schema)
            }
        }

        for (const keyword of singleSchemaKeywords) {
            const child: unknown = Reflect.get(current, keyword)
            if (Type.IsSchema(child)) {
                visit(child)
            }
        }
        for (const keyword of schemaArrayKeywords) {
            const children: unknown = Reflect.get(current, keyword)
            if (!Array.isArray(children)) {
                continue
            }
            for (const child of children) {
                if (Type.IsSchema(child)) {
                    visit(child)
                }
            }
        }
        for (const keyword of schemaRecordKeywords) {
            const children: unknown = Reflect.get(current, keyword)
            if (!isObject(children)) {
                continue
            }
            for (const key of Reflect.ownKeys(children)) {
                const child: unknown = Reflect.get(children, key)
                if (Type.IsSchema(child)) {
                    visit(child)
                }
            }
        }
    }

    visit(schema)
}

function applySchemaModifiers(source: Type.TSchema, target: Type.TSchema): Type.TSchema {
    const immutable = Type.IsImmutable(source) ? Type.Immutable(target) : target
    const readonly = Type.IsReadonly(source) ? Type.Readonly(immutable) : immutable
    return Type.IsOptional(source) ? Type.Optional(readonly) : readonly
}

function projectSchema(schema: Type.TSchema): Type.TSchema {
    const projectedValue = projectSchemaChildren(schema)
    const metadata = getVisibilityMetadata(schema)
    if (metadata === undefined) {
        return projectedValue
    }
    if (metadata.redaction.kind === 'omit') {
        return Type.Optional(projectedValue)
    }
    return applySchemaModifiers(
        schema,
        Type.Union([projectedValue, projectSchema(metadata.redaction.schema)])
    )
}

export function createProjectionSchema<Schema extends Type.TSchema>(
    schema: Schema
): ProjectedSchema<Schema>
export function createProjectionSchema(schema: Type.TSchema): Type.TSchema
export function createProjectionSchema(schema: Type.TSchema): Type.TSchema {
    return projectSchema(schema)
}
