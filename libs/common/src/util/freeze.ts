export function deepFreeze<T extends object>(object: T): Readonly<T> {
    const occurrences = new WeakSet<object>()

    function deepFreezeCircularlySafe<U extends object>(object: U): Readonly<U> {
        if (occurrences.has(object)) {
            return object
        }
        occurrences.add(object)

        // Retrieve the property names defined on object
        const propNames = Reflect.ownKeys(object)

        // Freeze properties before freezing self
        for (const name of propNames) {
            const value: unknown = Reflect.get(object, name)

            if ((value && typeof value === 'object') || typeof value === 'function') {
                deepFreezeCircularlySafe(value)
            }
        }

        return Object.freeze(object)
    }

    return deepFreezeCircularlySafe(object)
}
