const loadedFlags: Record<string, boolean> = $state({})

export function isLibraryLoaded(name: string): boolean {
    return loadedFlags[name] || false
}

export function markLibraryLoaded(name: string): void {
    loadedFlags[name] = true
}
