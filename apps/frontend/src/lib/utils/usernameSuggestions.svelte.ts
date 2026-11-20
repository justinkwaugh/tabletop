import { LatestRequest } from './latestRequest'

export class UsernameSuggestions {
    matches: string[] = $state([])
    private readonly requests = new LatestRequest()

    constructor(private readonly search: (text: string) => Promise<string[]>) {}

    async suggest(text: string, excluded: readonly string[]): Promise<void> {
        const current = this.requests.begin()
        const trimmed = text.trim()
        const found = trimmed.length > 1 ? await this.search(trimmed) : []
        if (current()) this.matches = found.filter((match) => !excluded.includes(match))
    }

    clear(): void {
        this.requests.cancel()
        this.matches = []
    }
}
