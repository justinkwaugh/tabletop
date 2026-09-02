import * as Type from 'typebox'
import { Compile, type Validator } from 'typebox/compile'
import * as Value from 'typebox/value'
import { SimultaneousAuctionVisibility } from '../components/auctions/simultaneous.js'
import { canViewSimultaneousAuctionBid } from '../components/auctions/simultaneousVisibility.js'
import type { GameState } from '../model/gameState.js'
import {
    createProjectionSchema,
    EmptyArrayAdapter,
    getScopeName,
    getVisibilityMetadata,
    Policy,
    ScopeKey,
    type Metadata,
    type ProjectedSchema,
    type ScopeMetadata,
    visitVisibilityMetadata
} from './visibilitySchema.js'

const omitted = Symbol('omitted visibility value')

export type Perspective = { kind: 'player'; playerId: string } | { kind: 'spectator' }

export interface PolicyContext<Root> {
    readonly perspective: Perspective
    readonly root: Readonly<Root>
    readonly value: unknown
    readonly parent: unknown
    readonly path: readonly (string | number)[]
    requireScope<Schema extends Type.TSchema & ScopeMetadata>(
        schema: Schema
    ): Readonly<Type.Static<Schema>>
}

export type PolicyResolver<Root> = (context: PolicyContext<Root>) => boolean
export type PolicyRegistry<Root> = Readonly<Record<string, PolicyResolver<Root>>>

export interface ProjectorOptions<Root> {
    readonly policies?: PolicyRegistry<Root>
}

export interface ValueProjector<Canonical, Projected = unknown> {
    readonly schema: Type.TSchema
    project(value: Canonical, perspective: Perspective): Projected
}

export interface GameVisibility<State extends GameState = GameState> {
    readonly state: ValueProjector<State, GameState>
}

interface TraversalContext<Root> {
    definitions: Type.TProperties
    parent?: unknown
    path: readonly (string | number)[]
    policies: PolicyRegistry<Root>
    perspective: Perspective
    recursiveSchema?: Type.TSchema
    root: Root
    scopes: readonly ScopeFrame[]
}

interface ScopeFrame {
    readonly name: string
    readonly value: unknown
}

export interface Projector<Schema extends Type.TSchema> extends ValueProjector<
    Type.Static<Schema>,
    Type.Static<ProjectedSchema<Schema>>
> {
    readonly schema: ProjectedSchema<Schema>
}

function isObjectValue(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function findPolicy<Root>(
    policies: PolicyRegistry<Root>,
    name: string
): PolicyResolver<Root> | undefined {
    return Object.hasOwn(policies, name) ? policies[name] : undefined
}

function isBuiltInPolicy(name: string): boolean {
    return (
        name === Policy.Actor ||
        name === Policy.HostOnly ||
        name === SimultaneousAuctionVisibility.Policy.Bid
    )
}

function assertSupportedDeclarations<Root>(schema: Type.TSchema, policies: PolicyRegistry<Root>) {
    visitVisibilityMetadata(schema, (metadata) => {
        if (
            !isBuiltInPolicy(metadata.policy) &&
            findPolicy(policies, metadata.policy) === undefined
        ) {
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

function childContext<Root>(
    context: TraversalContext<Root>,
    parent: unknown,
    segment: string | number
): TraversalContext<Root> {
    return {
        ...context,
        parent,
        path: [...context.path, segment]
    }
}

function enterScope<Root>(
    schema: Type.TSchema,
    value: unknown,
    context: TraversalContext<Root>
): TraversalContext<Root> {
    const name = getScopeName(schema)
    if (name === undefined) {
        return context
    }
    return {
        ...context,
        scopes: [...context.scopes, { name, value }]
    }
}

function requireScope<Schema extends Type.TSchema & ScopeMetadata>(
    schema: Schema,
    scopes: readonly ScopeFrame[]
): Readonly<Type.Static<Schema>> {
    const name = getScopeName(schema)
    if (name === undefined) {
        throw Error(`Visibility scope schema does not declare ${ScopeKey}`)
    }
    for (let index = scopes.length - 1; index >= 0; index -= 1) {
        const frame = scopes[index]
        if (frame.name !== name) {
            continue
        }
        const value = frame.value
        if (!Value.Check(schema, value)) {
            throw Error(`Value in visibility scope "${name}" does not match its schema`)
        }
        return value
    }
    throw Error(`No enclosing visibility scope found for "${name}"`)
}

function createPolicyContext<Root>(
    value: unknown,
    context: TraversalContext<Root>
): PolicyContext<Root> {
    return {
        perspective: context.perspective,
        root: context.root,
        value,
        parent: context.parent,
        path: context.path,
        requireScope: <Schema extends Type.TSchema & ScopeMetadata>(schema: Schema) =>
            requireScope(schema, context.scopes)
    }
}

function canViewCanonicalValue<Root>(
    metadata: Metadata,
    value: unknown,
    context: TraversalContext<Root>
): boolean {
    if (metadata.policy === Policy.HostOnly) {
        return false
    }
    if (metadata.policy === Policy.Actor) {
        if (!isObjectValue(context.root) || typeof context.root.playerId !== 'string') {
            throw Error(
                `The "${Policy.Actor}" visibility policy requires the projected root value to have a playerId`
            )
        }
        return (
            context.perspective.kind === 'player' &&
            context.perspective.playerId === context.root.playerId
        )
    }
    if (metadata.policy === SimultaneousAuctionVisibility.Policy.Bid) {
        return canViewSimultaneousAuctionBid(createPolicyContext(value, context))
    }
    const policy = findPolicy(context.policies, metadata.policy)
    if (policy === undefined) {
        throw Error(`No visibility policy registered for "${metadata.policy}"`)
    }
    return policy(createPolicyContext(value, context))
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

function projectObject<Root>(
    schema: Type.TObject,
    value: unknown,
    context: TraversalContext<Root>
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
        const projected = projectValue(
            propertySchema,
            value[key],
            childContext(context, value, key)
        )
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
            const projected = projectValue(
                additionalProperties,
                propertyValue,
                childContext(context, value, key)
            )
            if (projected !== omitted) {
                projectedEntries.push([key, projected])
            }
        }
    }

    return Object.fromEntries(projectedEntries)
}

function projectArray<Root>(
    schema: Type.TArray,
    value: unknown,
    context: TraversalContext<Root>
): unknown[] {
    if (!Array.isArray(value)) {
        throw Error('Cannot project a non-array value with an array schema')
    }

    const projectedItems: unknown[] = []
    for (const [index, item] of value.entries()) {
        const projected = projectValue(schema.items, item, childContext(context, value, index))
        if (projected !== omitted) {
            projectedItems.push(projected)
        }
    }
    return projectedItems
}

function projectTuple<Root>(
    schema: Type.TTuple,
    value: unknown,
    context: TraversalContext<Root>
): unknown[] {
    if (!Array.isArray(value)) {
        throw Error('Cannot project a non-array value with a tuple schema')
    }

    const projectedItems: unknown[] = []
    for (const [index, item] of value.entries()) {
        const itemSchema = schema.items[index]
        if (!Type.IsSchema(itemSchema)) {
            throw Error(`Cannot find tuple schema for item ${index}`)
        }
        const projected = projectValue(itemSchema, item, childContext(context, value, index))
        if (projected === omitted) {
            throw Error(`Cannot omit tuple item ${index}`)
        }
        projectedItems.push(projected)
    }
    return projectedItems
}

function projectRecord<Root>(
    schema: Type.TRecord,
    value: unknown,
    context: TraversalContext<Root>
): Record<string, unknown> {
    if (!isObjectValue(value)) {
        throw Error('Cannot project a non-object value with a record schema')
    }

    const valueSchema = Type.RecordValue(schema)
    const projectedEntries: [string, unknown][] = []
    for (const [key, item] of Object.entries(value)) {
        const projected = projectValue(valueSchema, item, childContext(context, value, key))
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

function projectUnion<Root>(
    schema: Type.TUnion,
    value: unknown,
    context: TraversalContext<Root>
): unknown {
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

function projectVisibleValue<Root>(
    schema: Type.TSchema,
    value: unknown,
    context: TraversalContext<Root>
): unknown {
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
            ...context,
            definitions: schema.$defs,
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

function projectValue<Root>(
    schema: Type.TSchema,
    value: unknown,
    context: TraversalContext<Root>
): unknown {
    const scopedContext = enterScope(schema, value, context)
    const metadata = getVisibilityMetadata(schema)
    if (metadata !== undefined && !canViewCanonicalValue(metadata, value, scopedContext)) {
        return redactValue(metadata)
    }
    return projectVisibleValue(schema, value, scopedContext)
}

class BuiltInProjector<Schema extends Type.TSchema> implements Projector<Schema> {
    readonly schema: ProjectedSchema<Schema>
    private readonly canonicalValidator: Validator<Type.TProperties, Schema>
    private readonly projectionValidator: Validator<Type.TProperties, ProjectedSchema<Schema>>

    constructor(
        private readonly canonicalSchema: Schema,
        private readonly policies: PolicyRegistry<Type.Static<Schema>>
    ) {
        assertSupportedDeclarations(canonicalSchema, policies)
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

        const result = projectValue(this.canonicalSchema, value, {
            definitions: {},
            path: [],
            policies: this.policies,
            perspective,
            root: value,
            scopes: []
        })
        const projected = result === omitted ? undefined : result
        if (!this.projectionValidator.Check(projected)) {
            throw Error('Visibility projection does not match its projection schema')
        }
        return projected
    }
}

export function createProjector<Schema extends Type.TSchema>(
    schema: Schema,
    options: ProjectorOptions<Type.Static<Schema>> = {}
): Projector<Schema> {
    return new BuiltInProjector(schema, options.policies ?? {})
}
