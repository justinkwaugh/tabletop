import type { SiteManifest } from '@tabletop/games-config'

// A process cannot unload game logic, so it keeps the logic and frontend it started with until
// a replacement process takes over. It reports only what it serves: a game whose logic changed
// keeps the publication this process loaded, and a game it never loaded is left out, so clients
// are never sent to a UI whose logic the backend does not run yet.
export const servedManifest = (
    live: SiteManifest,
    loaded: SiteManifest | undefined
): SiteManifest => {
    if (!loaded) return { ...live, games: [] }
    const loadedByPackage = new Map(loaded.games.map((entry) => [entry.packageId, entry]))
    const games = live.games.flatMap((entry) => {
        const loadedEntry = loadedByPackage.get(entry.packageId)
        if (!loadedEntry) return []
        return [loadedEntry.logicVersion === entry.logicVersion ? entry : loadedEntry]
    })
    return { ...live, frontend: loaded.frontend, games }
}
