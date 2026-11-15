import { vi } from 'vitest'

export function stubLocalStorage() {
    vi.stubGlobal('localStorage', memoryStorage())
}

export function stubSessionStorage() {
    vi.stubGlobal('sessionStorage', memoryStorage())
}

function memoryStorage() {
    const entries = new Map<string, string>()
    return {
        getItem: (key: string) => entries.get(key) ?? null,
        setItem: (key: string, value: string) => entries.set(key, value),
        removeItem: (key: string) => entries.delete(key)
    }
}
