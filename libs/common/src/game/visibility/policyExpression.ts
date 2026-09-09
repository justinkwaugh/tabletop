import type { GameConfig } from '../model/gameConfig.js'

export type PolicyValue = GameConfig[string]

export interface ConfigEqualsPolicy {
    readonly kind: 'configEquals'
    readonly key: string
    readonly value: PolicyValue
    readonly defaultValue?: PolicyValue
}

export interface StateEqualsPolicy {
    readonly kind: 'stateEquals'
    readonly field: string
    readonly value: PolicyValue
}

export interface AnyOfPolicy {
    readonly kind: 'anyOf'
    readonly policies: readonly PolicyExpression[]
}

export type PolicyExpression = string | ConfigEqualsPolicy | StateEqualsPolicy | AnyOfPolicy

export function configEquals(
    key: string,
    value: PolicyValue,
    options: { defaultValue?: PolicyValue } = {}
): ConfigEqualsPolicy {
    return { kind: 'configEquals', key, value, ...options }
}

export function stateEquals(field: string, value: PolicyValue): StateEqualsPolicy {
    return { kind: 'stateEquals', field, value }
}

export function anyOf(...policies: PolicyExpression[]): AnyOfPolicy {
    return { kind: 'anyOf', policies }
}

function isPolicyValue(value: unknown): value is PolicyValue {
    return (
        value === null ||
        typeof value === 'string' ||
        typeof value === 'boolean' ||
        (typeof value === 'number' && Number.isFinite(value))
    )
}

export function isPolicyExpression(value: unknown): value is PolicyExpression {
    if (typeof value === 'string') return true
    if (typeof value !== 'object' || value === null) return false
    const kind: unknown = Reflect.get(value, 'kind')
    if (kind === 'anyOf') {
        const policies: unknown = Reflect.get(value, 'policies')
        return Array.isArray(policies) && policies.length > 0 && policies.every(isPolicyExpression)
    }
    if (kind === 'stateEquals') {
        return (
            typeof Reflect.get(value, 'field') === 'string' &&
            isPolicyValue(Reflect.get(value, 'value'))
        )
    }
    if (kind === 'configEquals') {
        return (
            typeof Reflect.get(value, 'key') === 'string' &&
            isPolicyValue(Reflect.get(value, 'value')) &&
            (!Object.hasOwn(value, 'defaultValue') ||
                isPolicyValue(Reflect.get(value, 'defaultValue')))
        )
    }
    return false
}

export function visitPolicyExpression(
    policy: PolicyExpression,
    visitor: (policy: Exclude<PolicyExpression, AnyOfPolicy>) => void
): void {
    if (typeof policy !== 'string' && policy.kind === 'anyOf') {
        for (const child of policy.policies) visitPolicyExpression(child, visitor)
    } else visitor(policy)
}
