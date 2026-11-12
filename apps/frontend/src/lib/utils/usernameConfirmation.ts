export function confirmsUsername(typed: string | null | undefined, username: string): boolean {
    return username.length > 0 && typed?.trim().toLowerCase() === username.toLowerCase()
}
