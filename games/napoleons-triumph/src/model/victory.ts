import { GameResult } from '@tabletop/common'
import { Star, type LocaleId } from '../components/battleMap.js'
import { Side, UnitType } from '../components/pieces.js'
import { VictoryKind, type HydratedNapoleonsTriumphGameState } from './gameState.js'
import { faceOf } from './pieces.js'

const ALLIED_OBJECTIVES = [Star.Green, Star.Red, Star.Black]

export function declareVictory(
    state: HydratedNapoleonsTriumphGameState,
    winnerId: string,
    kind: VictoryKind
) {
    state.victory = kind
    state.winningPlayerIds = [winnerId]
    state.result = GameResult.Win
}

/** An army holds an objective with a corps that has infantry or artillery and a road back to a main-road entry (rule 16). */
export function controls(
    state: HydratedNapoleonsTriumphGameState,
    playerId: string,
    locale: LocaleId
): boolean {
    const garrisoned = state
        .commandersIn(locale, playerId)
        .some((commander) =>
            state
                .corpsUnits(commander.id)
                .some((unit) => faceOf(unit).type !== UnitType.Cavalry)
        )
    if (!garrisoned) {
        return false
    }
    const enemyHeld = (candidate: LocaleId) => state.isEnemyOccupied(candidate, playerId)
    return state.map
        .entries(state.sideOf(playerId))
        .filter((entry) => entry.main && !enemyHeld(entry.locale))
        .some(
            (entry) =>
                entry.locale === locale || state.map.roadConnects(locale, entry.locale, enemyHeld)
        )
}

export function controlledStars(
    state: HydratedNapoleonsTriumphGameState,
    playerId: string
): Star[] {
    const stars = state.map.allLocales
        .filter((locale) => locale.stars.length > 0 && controls(state, playerId, locale.id))
        .flatMap((locale) => locale.stars)
    return [...new Set(stars)]
}

/** The marginal victor once the last round is over (rule 16). */
export function marginalVictor(state: HydratedNapoleonsTriumphGameState): string {
    const french = state.playerOf(Side.French)
    const allied = state.playerOf(Side.Allied)
    const frenchStars = controlledStars(state, french.playerId)
    const alliedHoldBlue = controlledStars(state, allied.playerId).includes(Star.Blue)
    if (state.frenchReinforcementsEntered) {
        const frenchWin =
            !alliedHoldBlue && ALLIED_OBJECTIVES.every((star) => frenchStars.includes(star))
        return frenchWin ? french.playerId : allied.playerId
    }
    const alliedWin =
        alliedHoldBlue && !ALLIED_OBJECTIVES.some((star) => frenchStars.includes(star))
    return alliedWin ? allied.playerId : french.playerId
}
