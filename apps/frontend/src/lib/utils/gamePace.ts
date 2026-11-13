import {
    gamePaceOf,
    longestTurnWait,
    MILLISECONDS_PER_MINUTE,
    waitExceedsPace,
    type Game
} from '@tabletop/common'
import { GAME_PACE_LABELS } from '@tabletop/frontend-components'

export type TurnWaitDisplay = { wait: string; pastPace: boolean; description: string }

export function turnWaitDisplay(game: Game, now: Date): TurnWaitDisplay | undefined {
    const waited = longestTurnWait(game, now)
    if (waited === undefined) return undefined
    const wait = waitText(waited)
    const pastPace = waitExceedsPace(game, waited)
    return {
        wait,
        pastPace,
        description: pastPace
            ? `${wait}, past ${GAME_PACE_LABELS[gamePaceOf(game).pace].limit}`
            : wait
    }
}

// Each unit takes over at twice its size, so a wait just past a pace never reads as the pace itself.
export function waitText(milliseconds: number): string {
    const minutes = Math.floor(milliseconds / MILLISECONDS_PER_MINUTE)
    if (minutes < 120) return `${Math.max(1, minutes)} min`
    const hours = Math.floor(minutes / 60)
    if (hours < 48) return `${hours} h`
    return `${Math.floor(hours / 24)} days`
}
