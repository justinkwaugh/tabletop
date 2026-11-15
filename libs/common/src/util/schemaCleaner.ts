import * as Type from 'typebox'
import { Compile, type Validator } from 'typebox/compile'
import { Guard } from 'typebox/guard'
import * as Value from 'typebox/value'

type Clean = (value: unknown) => unknown
type Check = (value: unknown) => boolean
type SettleUnknownProperty = (value: Record<PropertyKey, unknown>, key: string) => void

/**
 * typebox's Value.Clean, built once per schema object. One cleaner per schema object and a member
 * check compiled only when a value reaches it keep the compiled code a title retains small
 * (docs/backend-restart-memory.md).
 */
export class SchemaCleaner {
    private static readonly unchanged: Clean = (value) => value
    private static readonly byValidator = new WeakMap<object, Clean>()
    private static readonly bySchema = new WeakMap<object, Clean>()

    static for(validator: Validator): Clean {
        const known = SchemaCleaner.byValidator.get(validator)
        if (known) return known
        const type = validator.Type()
        const cleaner = SchemaCleaner.usesKeywords(type, new Set())
            ? (value: unknown) => validator.Clean(value)
            : SchemaCleaner.cleanerFor(type)
        SchemaCleaner.byValidator.set(validator, cleaner)
        return cleaner
    }

    // A validator's definitions reach Value.Clean only through `$` keywords such as $ref.
    private static usesKeywords(node: unknown, seen: Set<object>): boolean {
        if (!Guard.IsObject(node) || seen.has(node)) return false
        seen.add(node)
        return Guard.Keys(node).some(
            (key) => key.startsWith('$') || SchemaCleaner.usesKeywords(node[key], seen)
        )
    }

    private static cleanerFor(type: unknown): Clean {
        if (!Guard.IsObject(type)) return SchemaCleaner.unchanged
        const known = SchemaCleaner.bySchema.get(type)
        if (known) return known
        const cleaner = SchemaCleaner.build(type)
        SchemaCleaner.bySchema.set(type, cleaner)
        return cleaner
    }

    // The order of typebox's FromType, which decides a schema matching more than one kind.
    private static build(type: object): Clean {
        if (Type.IsArray(type)) return SchemaCleaner.array(type)
        if (Type.IsBase(type)) return (value) => type.Clean(value)
        if (Type.IsIntersect(type))
            return SchemaCleaner.cleanerFor(SchemaCleaner.evaluatedIntersection(type))
        if (Type.IsObject(type)) return SchemaCleaner.object(type)
        if (Type.IsRecord(type)) return SchemaCleaner.record(type)
        if (Type.IsTuple(type)) return SchemaCleaner.tuple(type)
        if (Type.IsUnion(type)) return SchemaCleaner.union(type)
        return SchemaCleaner.unchanged
    }

    private static array(type: Type.TArray): Clean {
        const cleanItem = SchemaCleaner.cleanerFor(type.items)
        return (value) => (Guard.IsArray(value) ? value.map(cleanItem) : value)
    }

    private static evaluatedIntersection(type: Type.TIntersect): Type.TSchema {
        const evaluated = Type.Evaluate(type)
        if (!Type.IsObject(evaluated)) return evaluated
        return Type.Options(
            evaluated,
            Guard.HasPropertyKey(type, 'unevaluatedProperties')
                ? { additionalProperties: type.unevaluatedProperties }
                : {}
        )
    }

    private static object(type: Type.TObject): Clean {
        const properties = type.properties
        const cleaners = new Map(
            Guard.Keys(properties).map((key) => [key, SchemaCleaner.cleanerFor(properties[key])])
        )
        const settleUnknown = SchemaCleaner.unknownProperty(type)
        return (value) => {
            if (!Guard.IsObjectNotArray(value)) return value
            for (const key of Guard.Keys(value)) {
                const clean = cleaners.get(key)
                if (clean) value[key] = clean(value[key])
                else if (!Guard.HasPropertyKey(properties, key)) settleUnknown(value, key)
            }
            return value
        }
    }

    private static record(type: Type.TRecord): Clean {
        const pattern = new RegExp(Type.RecordPattern(type))
        const cleanValue = SchemaCleaner.cleanerFor(Type.RecordValue(type))
        const settleUnknown = SchemaCleaner.unknownProperty(type)
        return (value) => {
            if (!Guard.IsObject(value)) return value
            for (const key of Guard.Keys(value)) {
                if (pattern.test(key)) value[key] = cleanValue(value[key])
                else settleUnknown(value, key)
            }
            return value
        }
    }

    private static unknownProperty(type: object): SettleUnknownProperty {
        const additional = Guard.HasPropertyKey(type, 'additionalProperties')
            ? type.additionalProperties
            : undefined
        if (additional === true) return () => {}
        if (!Type.IsSchema(additional))
            return (value, key) => {
                delete value[key]
            }
        const accepts = SchemaCleaner.check(additional)
        const clean = SchemaCleaner.cleanerFor(additional)
        return (value, key) => {
            if (accepts(value[key])) value[key] = clean(value[key])
            else delete value[key]
        }
    }

    private static tuple(type: Type.TTuple): Clean {
        const cleaners = type.items.map((item) => SchemaCleaner.cleanerFor(item))
        return (value) => {
            if (!Guard.IsArray(value)) return value
            const length = Math.min(value.length, cleaners.length)
            for (let index = 0; index < length; index++)
                value[index] = cleaners[index](value[index])
            return value.length > length ? value.slice(0, length) : value
        }
    }

    private static union(type: Type.TUnion): Clean {
        const members = type.anyOf.map((member) => ({
            clean: SchemaCleaner.cleanerFor(member),
            accepts: SchemaCleaner.check(member)
        }))
        return (value) => {
            for (const { clean, accepts } of members) {
                const cleaned = clean(Value.Clone(value))
                if (accepts(cleaned)) return cleaned
            }
            return value
        }
    }

    private static check(type: Type.TSchema): Check {
        let compiled: Check | undefined
        return (value) => {
            if (!compiled) {
                const validator = Compile(type)
                compiled = (candidate) => validator.Check(candidate)
            }
            return compiled(value)
        }
    }
}
