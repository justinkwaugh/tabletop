export function migrateCompanyNames(value: unknown): boolean {
    if (!value || typeof value !== 'object') return false
    let changed = false
    for (const [key, entry] of Object.entries(value)) {
        if (entry === 'Charlottetown · Mainline') {
            Reflect.set(value, key, 'Charlottetown')
            changed = true
        } else if (migrateCompanyNames(entry)) changed = true
    }
    return changed
}
