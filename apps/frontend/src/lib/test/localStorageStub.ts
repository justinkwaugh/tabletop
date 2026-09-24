import { vi } from 'vitest'

export function stubLocalStorage() {
    const entries = new Map<string, string>()
    vi.stubGlobal('localStorage', {
        getItem: (key: string) => entries.get(key) ?? null,
        setItem: (key: string, value: string) => entries.set(key, value),
        removeItem: (key: string) => entries.delete(key)
    })
}
