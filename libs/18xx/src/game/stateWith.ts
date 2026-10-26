/**
 * A what-if copy of the state with the given members replaced and every other member read from
 * the state; members assigned on the copy stay on the copy. Never spread the state for this: in
 * a player's browser it is guarded, and listing its members touches hidden ones such as the
 * protected randomness, which throws. The state is not a prototype either, because the guard
 * would receive assignments meant for the copy.
 */
export function stateWith<State extends object, Members extends object>(
    state: State,
    members: Members
): State & Members {
    const own = { ...members } as Record<PropertyKey, unknown>
    return new Proxy(own, {
        get: (target, property) =>
            Object.hasOwn(target, property) ? target[property] : Reflect.get(state, property),
        set: (target, property, value) => {
            target[property] = value
            return true
        },
        has: (target, property) => property in target || property in state,
        getPrototypeOf: () => Reflect.getPrototypeOf(state)
    }) as State & Members
}
