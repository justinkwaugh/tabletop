import gamesJson from './games.json'

type GamePackage = [name: string, scope?: string]

function loadGamePackages(): GamePackage[] {
    const packages: GamePackage[] = gamesJson.games.map((fullName) => {
        const parts = fullName.split('/')
        if (parts.length === 2) {
            return [parts[1], parts[0]] as GamePackage
        } else {
            return [parts[0]] as GamePackage
        }
    })
    return packages
}

export const AvailableGames = loadGamePackages()
