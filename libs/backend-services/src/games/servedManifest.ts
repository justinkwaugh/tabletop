import type { SiteManifest, SiteManifestGame } from '@tabletop/games-config'

const runsSameLogic = (loaded: SiteManifestGame, live: SiteManifestGame) =>
    loaded.gameId === live.gameId && loaded.logicVersion === live.logicVersion

// A process cannot unload game logic, so it reports only what it loaded until a replacement
// process takes over; clients are never sent to a UI whose logic the backend does not run yet.
export const servedManifest = (live: SiteManifest, loaded: SiteManifest): SiteManifest => {
    const loadedByPackage = new Map(loaded.games.map((entry) => [entry.packageId, entry]))
    const games = live.games.flatMap((entry) => {
        const loadedEntry = loadedByPackage.get(entry.packageId)
        if (!loadedEntry) return []
        return [runsSameLogic(loadedEntry, entry) ? entry : loadedEntry]
    })
    return { ...live, frontend: loaded.frontend, games }
}
