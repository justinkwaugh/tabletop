import type { Game } from '@tabletop/common'

export function isNewerGame(game: Game, than: Game): boolean {
    return (game.updatedAt?.getTime() ?? 0) > (than.updatedAt?.getTime() ?? 0)
}
