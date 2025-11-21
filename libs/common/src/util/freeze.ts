export function deepFreeze(object: any) {
    const occurrences = new WeakSet()

    function deepFreezeCircularlySafe(object: any) {
        if (occurrences.has(object)) {
            return object
        }
        occurrences.add(object)

        // Retrieve the property names defined on object
        const propNames = Reflect.ownKeys(object)

        // Freeze properties before freezing self
        for (const name of propNames) {
            const value = object[name]

            if ((value && typeof value === 'object') || typeof value === 'function') {
                deepFreezeCircularlySafe(value)
            }
        }

        return Object.freeze(object)
    }

    return deepFreezeCircularlySafe(object)
}
