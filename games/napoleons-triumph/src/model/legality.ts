export function isLegal(check: () => void): boolean {
    return whyIllegal(check) === undefined
}

/** The rules checks throw to say what is wrong; this hands that reason back instead. */
export function whyIllegal(check: () => void): string | undefined {
    try {
        check()
        return undefined
    } catch (error) {
        return error instanceof Error ? error.message : String(error)
    }
}
