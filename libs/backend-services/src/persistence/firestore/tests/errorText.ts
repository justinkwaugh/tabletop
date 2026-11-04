export function errorText(error: unknown): string {
    if (!(error instanceof Error)) {
        return String(error ?? '')
    }
    const own = JSON.stringify(Object.fromEntries(Object.entries(error)))
    return [error.name, error.message, error.stack ?? '', own, errorText(error.cause)].join('\n')
}
