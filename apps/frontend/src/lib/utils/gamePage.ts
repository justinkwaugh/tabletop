export function gamePageDependency(gameId: string): `app:${string}` {
    return `app:game-page:${gameId}`
}
