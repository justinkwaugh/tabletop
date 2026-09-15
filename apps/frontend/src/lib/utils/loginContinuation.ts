const storageKey = 'loginContinuation'

export function saveLoginContinuation(path: string): void {
    sessionStorage.setItem(storageKey, path)
}

export function takeLoginContinuation(): string | undefined {
    const path = sessionStorage.getItem(storageKey)
    clearLoginContinuation()
    if (!path?.startsWith('/') || path.startsWith('//') || path.includes('\\')) return undefined
    const url = new URL(path, window.location.origin)
    if (url.origin !== window.location.origin) return undefined
    return `${url.pathname}${url.search}${url.hash}`
}

export function clearLoginContinuation(): void {
    sessionStorage.removeItem(storageKey)
}
