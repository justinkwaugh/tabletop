import * as Type from 'typebox'
import { Compile, type Validator } from 'typebox/compile'
import * as Value from 'typebox/value'
import {
    createProjectionSchema,
    EmptyArrayAdapter,
    getVisibilityMetadata,
    Policy,
    type Metadata,
    type ProjectedSchema,
    visitVisibilityMetadata
} from './visibilitySchema.js'

const omitted = Symbol('omitted visibility value')

export type Perspective = { kind: 'player'; playerId: string } | { kind: 'spectator' }

interface TraversalContext {
    definitions: Type.TProperties
    perspective: Perspective
    recursiveSchema?: Type.TSchema
}

export interface Projector<Schema extends Type.TSchema> {
    readonly schema: ProjectedSchema<Schema>
    project(
        value: Type.Static<Schema>,
        perspective: Perspective
    ): Type.Static<ProjectedSchema<Schema>>
}

function isObjectValue(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function assertSupportedDeclarations(schema: Type.TSchema) {
    visitVisibilityMetadata(schema, (metadata) => {
        if (metadata.policy !== Policy.HostOnly) {
            throw Error(`No visibility policy registered for "${metadata.policy}"`)
        }
        if (
            metadata.redaction.kind === 'replace' &&
            metadata.redaction.adapter !== EmptyArrayAdapter
        ) {
            throw Error(
                `No visibility redaction Adapter registered for "${metadata.redaction.adapter}"`
            )
        }
    })
}

function redactValue(metadata: Metadata): unknown {
    if (metadata.redaction.kind === 'omit') {
        return omitted
    }
    if (metadata.redaction.adapter === EmptyArrayAdapter) {
        return []
    }
    throw Error(`No visibility redaction Adapter registered for "${metadata.redaction.adapter}"`)
}

function projectObject(
    schema: Type.TObject,
    value: unknown,
    context: TraversalContext
): Record<string, unknown> {
    if (!isObjectValue(value)) {
        throw Error('Cannot project a non-object value with an object schema')
    }

    const projectedEntries: [string, unknown][] = []
    const declaredKeys = new Set(Object.keys(schema.properties))
    for (const [key, propertySchema] of Object.entries(schema.properties)) {
        if (!Object.hasOwn(value, key)) {
            continue
        }
        const projected = projectValue(propertySchema, value[key], context)
        if (projected !== omitted) {
            projectedEntries.push([key, projected])
        }
    }

    const additionalProperties: unknown = Reflect.get(schema, 'additionalProperties')
    for (const [key, propertyValue] of Object.entries(value)) {
        if (declaredKeys.has(key)) {
            continue
        }
        if (additionalProperties === true) {
            projectedEntries.push([key, Value.Clone(propertyValue)])
        } else if (Type.IsSchema(additionalProperties)) {
            const projected = projectValue(additionalProperties, propertyValue, context)
            if (projected !== omitted) {
                projectedEntries.push([key, projected])
            }
        }
    }

    return Object.fromEntries(projectedEntries)
}

function projectArray(schema: Type.TArray, value: unknown, context: TraversalContext): unknown[] {
    if (!Array.isArray(value)) {
        throw Error('Cannot project a non-array value with an array schema')
    }

    const projectedItems: unknown[] = []
    for (const item of value) {
        const projected = projectValue(schema.items, item, context)
        if (projected !== omitted) {
            projectedItems.push(projected)
        }
    }
    return projectedItems
}

function projectTuple(schema: Type.TTuple, value: unknown, context: TraversalContext): unknown[] {
    if (!Array.isArray(value)) {
        throw Error('Cannot project a non-array value with a tuple schema')
    }

    const projectedItems: unknown[] = []
    for (const [index, item] of value.entries()) {
        const itemSchema = schema.items[index]
        if (!Type.IsSchema(itemSchema)) {
            throw Error(`Cannot find tuple schema for item ${index}`)
        }
        const projected = projectValue(itemSchema, item, context)
        if (projected === omitted) {
            throw Error(`Cannot omit tuple item ${index}`)
        }
        projectedItems.push(projected)
    }
    return projectedItems
}

function projectRecord(
    schema: Type.TRecord,
    value: unknown,
    context: TraversalContext
): Record<string, unknown> {
    if (!isObjectValue(value)) {
        throw Error('Cannot project a non-object value with a record schema')
    }

    const valueSchema = Type.RecordValue(schema)
    const projectedEntries: [string, unknown][] = []
    for (const [key, item] of Object.entries(value)) {
        const projected = projectValue(valueSchema, item, context)
        if (projected !== omitted) {
            projectedEntries.push([key, projected])
        }
    }
    return Object.fromEntries(projectedEntries)
}

function projectionsEqual(left: unknown, right: unknown): boolean {
    if (left === omitted || right === omitted) {
        return left === right
    }
    return Value.Equal(left, right)
}

function projectUnion(schema: Type.TUnion, value: unknown, context: TraversalContext): unknown {
    const matchingSchemas = schema.anyOf.filter((candidate) =>
        Value.Check(context.definitions, candidate, value)
    )
    if (matchingSchemas.length === 0) {
        throw Error('Cannot find a matching visibility union branch')
    }

    const projections = matchingSchemas.map((candidate) => projectValue(candidate, value, context))
    const first = projections[0]
    if (!projections.every((projection) => projectionsEqual(first, projection))) {
        throw Error('Visibility projection is ambiguous across matching union branches')
    }
    return first
}

function resolveReference(definitions: Type.TProperties, reference: string): Type.TSchema {
    const schema: unknown = Reflect.get(definitions, reference)
    if (!Type.IsSchema(schema)) {
        throw Error(`Cannot resolve visibility schema reference "${reference}"`)
    }
    return schema
}

function projectValue(schema: Type.TSchema, value: unknown, context: TraversalContext): unknown {
    const metadata = getVisibilityMetadata(schema)
    if (metadata !== undefined) {
        return redactValue(metadata)
    }
    if (Type.IsObject(schema)) {
        return projectObject(schema, value, context)
    }
    if (Type.IsArray(schema)) {
        return projectArray(schema, value, context)
    }
    if (Type.IsTuple(schema)) {
        return projectTuple(schema, value, context)
    }
    if (Type.IsRecord(schema)) {
        return projectRecord(schema, value, context)
    }
    if (Type.IsUnion(schema)) {
        return projectUnion(schema, value, context)
    }
    if (Type.IsIntersect(schema)) {
        const evaluated = Type.Evaluate(schema)
        if (Type.IsIntersect(evaluated)) {
            throw Error('Cannot evaluate intersected visibility schema')
        }
        return projectValue(evaluated, value, context)
    }
    if (Type.IsCyclic(schema)) {
        const recursiveSchema = resolveReference(schema.$defs, schema.$ref)
        return projectValue(recursiveSchema, value, {
            definitions: schema.$defs,
            perspective: context.perspective,
            recursiveSchema
        })
    }
    if (Type.IsRef(schema)) {
        return projectValue(resolveReference(context.definitions, schema.$ref), value, context)
    }
    if (Type.IsThis(schema)) {
        if (context.recursiveSchema === undefined) {
            throw Error('Cannot resolve recursive visibility schema')
        }
        return projectValue(context.recursiveSchema, value, context)
    }
    return Value.Clone(value)
}

class BuiltInProjector<Schema extends Type.TSchema> implements Projector<Schema> {
    readonly schema: ProjectedSchema<Schema>
    private readonly canonicalValidator: Validator<Type.TProperties, Schema>
    private readonly projectionValidator: Validator<Type.TProperties, ProjectedSchema<Schema>>

    constructor(private readonly canonicalSchema: Schema) {
        assertSupportedDeclarations(canonicalSchema)
        this.schema = createProjectionSchema(canonicalSchema)
        this.canonicalValidator = Compile(canonicalSchema)
        this.projectionValidator = Compile(this.schema)
    }

    project(
        value: Type.Static<Schema>,
        perspective: Perspective
    ): Type.Static<ProjectedSchema<Schema>> {
        if (!this.canonicalValidator.Check(value)) {
            throw Error('Cannot project a value that does not match its canonical schema')
        }

        const result = projectValue(this.canonicalSchema, value, { definitions: {}, perspective })
        const projected = result === omitted ? undefined : result
        if (!this.projectionValidator.Check(projected)) {
            throw Error('Visibility projection does not match its projection schema')
        }
        return projected
    }
}

export function createProjector<Schema extends Type.TSchema>(schema: Schema): Projector<Schema> {
    return new BuiltInProjector(schema)
}
