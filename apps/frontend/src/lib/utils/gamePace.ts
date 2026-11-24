import { gamePaceOf, lastMoveAt, waitExceedsPace, type Game } from '@tabletop/common'
import { GAME_PACE_LABELS } from '@tabletop/frontend-components'

export function lastMovePaceWarning(game: Game, now: Date): string | undefined {
    if (!waitExceedsPace(game, now.getTime() - lastMoveAt(game).getTime())) return undefined
    return `Past ${GAME_PACE_LABELS[gamePaceOf(game).pace].limit}`
}
