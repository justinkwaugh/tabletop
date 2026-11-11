import { GameResult, assert } from '@tabletop/common'
import { Star, type LocaleId } from '../components/battleMap.js'
import { Side, UnitType, type Face } from '../components/pieces.js'
import { VictoryKind, type HydratedNapoleonsTriumphGameState } from './gameState.js'
import { knownFace, type ProjectedUnit } from './pieces.js'

/** Rule 16: the French are scored on the green, red and black stars, the Allies on the blue. */
export const STARS_SOUGHT: Record<Side, Star[]> = {
    [Side.French]: [Star.Green, Star.Red, Star.Black],
    [Side.Allied]: [Star.Blue]
}

export enum Hold {
    Held = 'held',
    Possible = 'possible'
}

export type FaceReader = (unit: ProjectedUnit) => Face | undefined

export interface LocaleHold {
    locale: LocaleId
    hold: Hold
}

export interface StarHold {
    star: Star
    locales: LocaleHold[]
}

/** Rule 16: "Units are turned face-up after the game for verification purposes." */
export function declareVictory(
    state: HydratedNapoleonsTriumphGameState,
    winnerId: string,
    kind: VictoryKind
) {
    state.victory = kind
    state.winningPlayerIds = [winnerId]
    state.result = GameResult.Win
    state.revealAll(state.units)
}

/** An army holds an objective with a corps that has infantry or artillery and a road back to a main-road entry (rule 16); a face the viewer cannot see might be either. */
function holdOn(
    state: HydratedNapoleonsTriumphGameState,
    playerId: string,
    locale: LocaleId,
    faceOf: FaceReader
): Hold | undefined {
    const garrison = garrisonOf(state, playerId, locale, faceOf)
    return garrison !== undefined && suppliedByRoad(state, playerId, locale) ? garrison : undefined
}

function garrisonOf(
    state: HydratedNapoleonsTriumphGameState,
    playerId: string,
    locale: LocaleId,
    faceOf: FaceReader
): Hold | undefined {
    const faces = state
        .commandersIn(locale, playerId)
        .flatMap((commander) => state.corpsUnits(commander.id).map(faceOf))
    if (faces.some((face) => face !== undefined && face.type !== UnitType.Cavalry)) {
        return Hold.Held
    }
    return faces.includes(undefined) ? Hold.Possible : undefined
}

function suppliedByRoad(
    state: HydratedNapoleonsTriumphGameState,
    playerId: string,
    locale: LocaleId
): boolean {
    const enemyHeld = (candidate: LocaleId) => state.isEnemyOccupied(candidate, playerId)
    return state.map
        .entries(state.sideOf(playerId))
        .filter((entry) => entry.main && !enemyHeld(entry.locale))
        .some(
            (entry) =>
                entry.locale === locale || state.map.roadConnects(locale, entry.locale, enemyHeld)
        )
}

export function objectiveHolds(
    state: HydratedNapoleonsTriumphGameState,
    playerId: string,
    faceOf: FaceReader = knownFace
): StarHold[] {
    const holds = state.map.allLocales
        .filter((locale) => locale.stars.length > 0)
        .flatMap((locale) => {
            const hold = holdOn(state, playerId, locale.id, faceOf)
            return hold === undefined ? [] : [{ locale, hold }]
        })
    return STARS_SOUGHT[state.sideOf(playerId)].map((star) => ({
        star,
        locales: holds
            .filter(({ locale }) => locale.stars.includes(star))
            .map(({ locale, hold }) => ({ locale: locale.id, hold }))
    }))
}

function controlledStars(state: HydratedNapoleonsTriumphGameState, playerId: string): Star[] {
    const holds = objectiveHolds(state, playerId)
    assert(
        holds.every(({ locales }) => locales.every(({ hold }) => hold === Hold.Held)),
        'Objectives are decided with every face known'
    )
    return holds.filter(({ locales }) => locales.length > 0).map(({ star }) => star)
}

/** The marginal victor once the last round is over (rule 16). */
export function marginalVictor(state: HydratedNapoleonsTriumphGameState): string {
    const french = state.playerOf(Side.French)
    const allied = state.playerOf(Side.Allied)
    const frenchStars = controlledStars(state, french.playerId)
    const alliedHoldBlue = controlledStars(state, allied.playerId).includes(Star.Blue)
    if (state.frenchReinforcementsEntered) {
        const frenchWin =
            !alliedHoldBlue && STARS_SOUGHT[Side.French].every((star) => frenchStars.includes(star))
        return frenchWin ? french.playerId : allied.playerId
    }
    const alliedWin = alliedHoldBlue && frenchStars.length === 0
    return alliedWin ? allied.playerId : french.playerId
}
