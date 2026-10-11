export class IllegalPlay extends Error {}

export function legal(condition: unknown, reason: string): asserts condition {
    if (!condition) {
        throw new IllegalPlay(reason)
    }
}

export function whyIllegal(check: () => void): string | undefined {
    try {
        check()
        return undefined
    } catch (error) {
        if (error instanceof IllegalPlay) {
            return error.message
        }
        throw error
    }
}

export function isLegal(check: () => void): boolean {
    return whyIllegal(check) === undefined
}
