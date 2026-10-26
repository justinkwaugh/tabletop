/**
 * A what-if copy of the state. Never spread the state for one: in a player's browser, listing its
 * members throws on the hidden ones.
 */
export function stateWith<State extends object, Key extends keyof State>(
    state: State,
    changes: Pick<State, Key>
): State {
    const changed = new Map<string | symbol, unknown>(Object.entries(changes))
    const deleted = new Set<string | symbol>()
    const change = (property: string | symbol, value: unknown) => {
        deleted.delete(property)
        changed.set(property, value)
        return true
    }
    return new Proxy(state, {
        get: (target, property, receiver) => {
            if (deleted.has(property)) return undefined
            if (changed.has(property)) return changed.get(property)
            return Reflect.get(target, property, receiver)
        },
        set: (_target, property, value) => change(property, value),
        defineProperty: (_target, property, descriptor) =>
            'value' in descriptor && change(property, descriptor.value),
        deleteProperty: (_target, property) => {
            changed.delete(property)
            deleted.add(property)
            return true
        },
        has: (target, property) =>
            !deleted.has(property) && (changed.has(property) || Reflect.has(target, property)),
        ownKeys: (target) => [
            ...new Set(
                [...Reflect.ownKeys(target), ...changed.keys()].filter(
                    (property) => !deleted.has(property)
                )
            )
        ],
        getOwnPropertyDescriptor: (target, property) => {
            if (deleted.has(property)) return undefined
            if (!changed.has(property)) return Reflect.getOwnPropertyDescriptor(target, property)
            return {
                value: changed.get(property),
                writable: true,
                enumerable: true,
                configurable: true
            }
        },
        setPrototypeOf: () => false,
        preventExtensions: () => false
    })
}
