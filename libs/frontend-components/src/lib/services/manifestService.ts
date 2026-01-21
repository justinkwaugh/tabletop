export type ManifestService = {
    getFrontendVersion(): string | undefined
    getLogicVersion(gameId: string): string | undefined
    getUiVersion(gameId: string): string | undefined
}
