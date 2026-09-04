import * as Type from 'typebox'
import { Compile, type Validator } from 'typebox/compile'
import * as Value from 'typebox/value'
import { SimultaneousAuctionVisibility } from '../components/auctions/simultaneous.js'
import { canViewSimultaneousAuctionBid } from '../components/auctions/simultaneousVisibility.js'
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
const unavailableProjectedValue = Symbol.for(
    '@tabletop/common.visibility.unavailable-projected-value'
)

export type Perspective = Type.Static<typeof Perspective>
export const Perspective = Type.Union([
    Type.Object({ kind: Type.Literal('player'), playerId: Type.String() }),
    Type.Object({ kind: Type.Literal('spectator') })
])

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

type RedactionAdapter<Root> = (context: PolicyContext<Root>) => unknown
type RedactionAdapterRegistry<Root> = Readonly<Record<string, RedactionAdapter<Root>>>

export interface ValueProjector<Canonical, Projected = unknown> {
    readonly schema: Type.TSchema
    project(value: Canonical, perspective: Perspective): Projected
    /** Wraps hydrated state so game runtime code cannot use values unavailable to its Perspective. */
    guardForExecution<Value extends object>(value: Value, perspective: Perspective): Value
}

export class UnavailableProjectedValueError extends Error {
    constructor(readonly path: readonly (string | number)[]) {
        const pointer = path.length === 0 ? '/' : `/${path.map(escapePointerSegment).join('/')}`
        super(`Projected execution cannot access protected value at ${pointer}`)
        this.name = 'UnavailableProjectedValueError'
        Reflect.defineProperty(this, unavailableProjectedValue, { value: true })
    }
}

export function isUnavailableProjectedValueError(
    value: unknown
): value is UnavailableProjectedValueError {
    return isObject(value) && Reflect.get(value, unavailableProjectedValue) === true
}

interface TraversalContext<Root> {
    adapters: RedactionAdapterRegistry<Root>
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

function isObject(value: unknown): value is object {
    return typeof value === 'object' && value !== null
}

function escapePointerSegment(segment: string | number): string {
    return String(segment).replaceAll('~', '~0').replaceAll('/', '~1')
}

function findPolicy<Root>(
    policies: PolicyRegistry<Root>,
    name: string
): PolicyResolver<Root> | undefined {
    return Object.hasOwn(policies, name) ? policies[name] : undefined
}

function findRedactionAdapter<Root>(
    adapters: RedactionAdapterRegistry<Root>,
    name: string
): RedactionAdapter<Root> | undefined {
    return Object.hasOwn(adapters, name) ? adapters[name] : undefined
}

function isBuiltInPolicy(name: string): boolean {
    return (
        name === Policy.Actor ||
        name === Policy.HostOnly ||
        name === SimultaneousAuctionVisibility.Policy.Bid
    )
}

function assertSupportedDeclarations<Root>(
    schema: Type.TSchema,
    policies: PolicyRegistry<Root>,
    adapters: RedactionAdapterRegistry<Root>
) {
    visitVisibilityMetadata(schema, (metadata) => {
        if (
            !isBuiltInPolicy(metadata.policy) &&
            findPolicy(policies, metadata.policy) === undefined
        ) {
            throw Error(`No visibility policy registered for "${metadata.policy}"`)
        }
        if (
            metadata.redaction.kind === 'replace' &&
            metadata.redaction.adapter !== EmptyArrayAdapter &&
            findRedactionAdapter(adapters, metadata.redaction.adapter) === undefined
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

function builtInPolicyResult<Root>(
    metadata: Metadata,
    value: unknown,
    context: TraversalContext<Root>
): boolean | undefined {
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
    return undefined
}

function canViewCanonicalValue<Root>(
    metadata: Metadata,
    value: unknown,
    context: TraversalContext<Root>
): boolean {
    const builtInResult = builtInPolicyResult(metadata, value, context)
    if (builtInResult !== undefined) {
        return builtInResult
    }
    const policy = findPolicy(context.policies, metadata.policy)
    if (policy === undefined) {
        throw Error(`No visibility policy registered for "${metadata.policy}"`)
    }
    return policy(createPolicyContext(value, context))
}

function redactValue<Root>(
    metadata: Metadata,
    value: unknown,
    context: TraversalContext<Root>
): unknown {
    if (metadata.redaction.kind === 'omit') {
        return omitted
    }
    if (metadata.redaction.adapter === EmptyArrayAdapter) {
        return []
    }
    const adapter = findRedactionAdapter(context.adapters, metadata.redaction.adapter)
    if (adapter !== undefined) {
        return adapter(createPolicyContext(value, context))
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
        if (
            !Object.hasOwn(value, key) ||
            (value[key] === undefined && Type.IsOptional(propertySchema))
        ) {
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
        return redactValue(metadata, value, scopedContext)
    }
    return projectVisibleValue(schema, value, scopedContext)
}

interface GuardFrame {
    readonly schema: Type.TSchema
    readonly context: TraversalContext<unknown>
}

interface GuardedChild {
    readonly source: object
    readonly guarded: object
}

const visibilityMetadataPresence = new WeakMap<object, boolean>()

function containsVisibilityMetadata(schema: Type.TSchema): boolean {
    const cached = visibilityMetadataPresence.get(schema)
    if (cached !== undefined) {
        return cached
    }
    let found = false
    visitVisibilityMetadata(schema, () => {
        found = true
    })
    visibilityMetadataPresence.set(schema, found)
    return found
}

function arrayIndex(property: PropertyKey): number | undefined {
    if (typeof property !== 'string' || property === '') {
        return undefined
    }
    const index = Number(property)
    return Number.isSafeInteger(index) && index >= 0 && String(index) === property
        ? index
        : undefined
}

class ProjectedExecutionGuard {
    private readonly rawValues = new WeakMap<object, object>()

    constructor(private readonly perspective: Perspective) {}

    guard<Value extends object>(schema: Type.TSchema, value: Value): Value {
        const frame = this.prepareFrame(schema, value, {
            adapters: {},
            definitions: {},
            path: [],
            policies: {},
            perspective: this.perspective,
            root: value,
            scopes: []
        })
        if (!containsVisibilityMetadata(frame.schema)) {
            return value
        }
        return this.createProxy(frame, value)
    }

    private prepareFrame(
        schema: Type.TSchema,
        value: unknown,
        context: TraversalContext<unknown>
    ): GuardFrame {
        const scopedContext = enterScope(schema, value, context)
        const metadata = getVisibilityMetadata(schema)
        if (metadata !== undefined) {
            // Custom policies may depend on canonical data absent from this projection. Only a
            // built-in policy whose answer is reproducible locally can prove access is safe.
            const policyResult = builtInPolicyResult(metadata, value, scopedContext)
            if (policyResult !== true) {
                throw new UnavailableProjectedValueError(scopedContext.path)
            }
        }

        if (Type.IsIntersect(schema)) {
            const evaluated = Type.Evaluate(schema)
            if (Type.IsIntersect(evaluated)) {
                throw new UnavailableProjectedValueError(scopedContext.path)
            }
            return this.prepareFrame(evaluated, value, scopedContext)
        }
        if (Type.IsUnion(schema)) {
            const matchingSchemas = schema.anyOf.filter(
                (candidate) =>
                    Value.Check(scopedContext.definitions, candidate, value) ||
                    Value.Check(scopedContext.definitions, createProjectionSchema(candidate), value)
            )
            if (matchingSchemas.length !== 1) {
                throw new UnavailableProjectedValueError(scopedContext.path)
            }
            return this.prepareFrame(matchingSchemas[0], value, scopedContext)
        }
        if (Type.IsCyclic(schema)) {
            const recursiveSchema = resolveReference(schema.$defs, schema.$ref)
            return this.prepareFrame(recursiveSchema, value, {
                ...scopedContext,
                definitions: schema.$defs,
                recursiveSchema
            })
        }
        if (Type.IsRef(schema)) {
            return this.prepareFrame(
                resolveReference(scopedContext.definitions, schema.$ref),
                value,
                scopedContext
            )
        }
        if (Type.IsThis(schema)) {
            if (scopedContext.recursiveSchema === undefined) {
                throw new UnavailableProjectedValueError(scopedContext.path)
            }
            return this.prepareFrame(scopedContext.recursiveSchema, value, scopedContext)
        }
        return { schema, context: scopedContext }
    }

    private createProxy<Value extends object>(frame: GuardFrame, value: Value): Value {
        const children = new Map<PropertyKey, GuardedChild>()
        const guarded = new Proxy(value, {
            get: (target, property, receiver) => {
                const child = this.childFrame(frame, target, property)
                if (child === undefined) {
                    return Reflect.get(target, property, receiver)
                }
                const childValue = Reflect.get(target, property, receiver)
                if (isObject(childValue)) {
                    const existing = children.get(property)
                    if (existing?.source === childValue) {
                        return existing.guarded
                    }
                }
                const guardedChild = this.guardValue(child, childValue)
                if (isObject(childValue) && isObject(guardedChild)) {
                    children.set(property, { source: childValue, guarded: guardedChild })
                }
                return guardedChild
            },
            set: (target, property, nextValue) => {
                const child = this.childFrame(frame, target, property)
                const rawValue = this.unwrap(nextValue)
                if (child !== undefined) {
                    this.prepareFrame(child.schema, rawValue, child.context)
                }
                children.delete(property)
                return Reflect.set(target, property, rawValue, target)
            },
            has: (target, property) => {
                this.assertPropertyAccess(frame, target, property)
                return Reflect.has(target, property)
            },
            deleteProperty: (target, property) => {
                this.assertPropertyAccess(frame, target, property)
                children.delete(property)
                return Reflect.deleteProperty(target, property)
            },
            defineProperty: (target, property, descriptor) => {
                const child = this.childFrame(frame, target, property)
                if (child !== undefined) {
                    const nextValue = Object.hasOwn(descriptor, 'value')
                        ? descriptor.value
                        : Reflect.get(target, property)
                    this.prepareFrame(child.schema, nextValue, child.context)
                }
                children.delete(property)
                return Reflect.defineProperty(target, property, descriptor)
            },
            getOwnPropertyDescriptor: (target, property) => {
                this.assertPropertyAccess(frame, target, property)
                return Reflect.getOwnPropertyDescriptor(target, property)
            },
            ownKeys: (target) => {
                this.assertKeyEnumeration(frame, target)
                return Reflect.ownKeys(target)
            }
        })
        this.rawValues.set(guarded, value)
        return guarded
    }

    private guardValue(frame: GuardFrame, value: unknown): unknown {
        const prepared = this.prepareFrame(frame.schema, value, frame.context)
        if (!isObject(value) || !containsVisibilityMetadata(prepared.schema)) {
            return value
        }
        return this.createProxy(prepared, value)
    }

    private unwrap(value: unknown): unknown {
        return isObject(value) ? (this.rawValues.get(value) ?? value) : value
    }

    private assertPropertyAccess(frame: GuardFrame, target: object, property: PropertyKey) {
        const child = this.childFrame(frame, target, property)
        if (child !== undefined) {
            this.prepareFrame(child.schema, Reflect.get(target, property), child.context)
        }
    }

    private assertKeyEnumeration(frame: GuardFrame, target: object) {
        if (!Type.IsObject(frame.schema)) {
            return
        }
        for (const [property, schema] of Object.entries(frame.schema.properties)) {
            const context = childContext(frame.context, target, property)
            this.prepareFrame(schema, Reflect.get(target, property), context)
        }
    }

    private childFrame(
        frame: GuardFrame,
        target: object,
        property: PropertyKey
    ): GuardFrame | undefined {
        if (Type.IsObject(frame.schema) && typeof property === 'string') {
            const propertySchema = frame.schema.properties[property]
            if (Type.IsSchema(propertySchema)) {
                return {
                    schema: propertySchema,
                    context: childContext(frame.context, target, property)
                }
            }
            const additionalProperties: unknown = Reflect.get(frame.schema, 'additionalProperties')
            if (Type.IsSchema(additionalProperties)) {
                return {
                    schema: additionalProperties,
                    context: childContext(frame.context, target, property)
                }
            }
            return undefined
        }

        const index = arrayIndex(property)
        if (index === undefined) {
            if (
                Type.IsRecord(frame.schema) &&
                typeof property === 'string' &&
                (Object.hasOwn(target, property) || !(property in Object.prototype))
            ) {
                return {
                    schema: Type.RecordValue(frame.schema),
                    context: childContext(frame.context, target, property)
                }
            }
            return undefined
        }
        if (Type.IsArray(frame.schema)) {
            return {
                schema: frame.schema.items,
                context: childContext(frame.context, target, index)
            }
        }
        if (Type.IsTuple(frame.schema)) {
            const itemSchema = frame.schema.items[index]
            if (Type.IsSchema(itemSchema)) {
                return {
                    schema: itemSchema,
                    context: childContext(frame.context, target, index)
                }
            }
        }
        return undefined
    }
}

class BuiltInProjector<Schema extends Type.TSchema> implements Projector<Schema> {
    readonly schema: ProjectedSchema<Schema>
    private readonly canonicalValidator: Validator<Type.TProperties, Schema>
    private readonly projectionValidator: Validator<Type.TProperties, ProjectedSchema<Schema>>

    constructor(
        private readonly canonicalSchema: Schema,
        private readonly policies: PolicyRegistry<Type.Static<Schema>>,
        private readonly adapters: RedactionAdapterRegistry<Type.Static<Schema>>
    ) {
        assertSupportedDeclarations(canonicalSchema, policies, adapters)
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
            adapters: this.adapters,
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

    guardForExecution<Value extends object>(value: Value, perspective: Perspective): Value {
        return new ProjectedExecutionGuard(perspective).guard(this.canonicalSchema, value)
    }
}

export function createProjector<Schema extends Type.TSchema>(
    schema: Schema,
    options: ProjectorOptions<Type.Static<Schema>> = {}
): Projector<Schema> {
    return createProjectorWithRedactionAdapters(schema, options, {})
}

export function createProjectorWithRedactionAdapters<Schema extends Type.TSchema>(
    schema: Schema,
    options: ProjectorOptions<Type.Static<Schema>>,
    redactionAdapters: RedactionAdapterRegistry<Type.Static<Schema>>
): Projector<Schema> {
    return new BuiltInProjector(schema, options.policies ?? {}, redactionAdapters)
}
