import { assert, assertExists } from '@tabletop/common'
import { SANTON_LOCALE } from '../components/austerlitz.js'
import {
    MAX_CORPS_UNITS,
    Side,
    UnitType,
    commanderDefinition,
    commandersOf
} from '../components/pieces.js'
import { Scenario } from '../components/timeTrack.js'
import { HydratedNapoleonsTriumphGameState } from '../model/gameState.js'
import { isLegal } from '../model/legality.js'
import { faceOf, type ProjectedUnit } from '../model/pieces.js'
import {
    ALLIED_ADVANCE_GUARD_CORPS,
    deployArmy,
    type CorpsDeployment,
    type Deployment
} from '../model/setup.js'

function firstWith(
    pool: ProjectedUnit[],
    match: (unit: ProjectedUnit) => boolean
): ProjectedUnit | undefined {
    return pool.find(match) ?? pool[0]
}

function setupLocaleId(state: HydratedNapoleonsTriumphGameState, commanderId: string): number {
    const locale = state.map.setupLocale(commanderId)
    assertExists(locale, `${commanderId} has no set-up locale`)
    return locale.id
}

function stepsFromTheSanton(state: HydratedNapoleonsTriumphGameState, commanderId: string): number {
    return state.map.distance(setupLocaleId(state, commanderId), SANTON_LOCALE) ?? Infinity
}

function fixedBatteryOnTheSanton(
    state: HydratedNapoleonsTriumphGameState,
    playerId: string,
    deployment: Deployment
): Deployment | undefined {
    const posted = deployment.corps
        .filter((corps) => !corps.offMap)
        .toSorted(
            (a, b) =>
                stepsFromTheSanton(state, a.commanderId) - stepsFromTheSanton(state, b.commanderId)
        )
        .flatMap((corps) =>
            corps.unitIds.filter((id) => faceOf(state.unit(id)).type === UnitType.Artillery)
        )
        .map((unitId): Deployment => ({
            ...deployment,
            detachments: [{ unitId, position: { locale: SANTON_LOCALE } }],
            fixedBattery: { unitId }
        }))
    return posted.find((candidate) =>
        isLegal(() =>
            deployArmy(
                new HydratedNapoleonsTriumphGameState(structuredClone(state.dehydrate())),
                playerId,
                candidate
            )
        )
    )
}

/** A legal set-up for specs that are not about set-up: every corps gets its minimum, the rest is dealt out evenly. */
export function suggestedDeployment(
    state: HydratedNapoleonsTriumphGameState,
    side: Side
): Deployment {
    const playerId = state.playerOf(side).playerId
    const pool = state.unitsOf(playerId).toSorted((a, b) => a.id.localeCompare(b.id))
    const commanders = commandersOf(side)
    const offMap = (commanderId: string): boolean =>
        side === Side.French
            ? commanderDefinition(commanderId).reinforcement === true
            : state.scenario === Scenario.December1 &&
              commanders.findIndex((commander) => commander.id === commanderId) >=
                  ALLIED_ADVANCE_GUARD_CORPS
    const assigned = new Map<string, string[]>(commanders.map((commander) => [commander.id, []]))
    const unitIdsOf = (commanderId: string): string[] => {
        const unitIds = assigned.get(commanderId)
        assertExists(unitIds, `${commanderId} does not command in this army`)
        return unitIds
    }
    const sizeOf = (commanderId: string): number => unitIdsOf(commanderId).length
    const take = (commanderId: string, unit: ProjectedUnit | undefined) => {
        assertExists(unit, 'Ran out of units while deploying')
        pool.splice(pool.indexOf(unit), 1)
        unitIdsOf(commanderId).push(unit.id)
    }
    const roomFor = (commanderId: string): number =>
        offMap(commanderId)
            ? MAX_CORPS_UNITS
            : Math.min(
                  MAX_CORPS_UNITS,
                  state.map.locale(setupLocaleId(state, commanderId)).capacity
              )
    for (const commander of commanders) {
        if (commander.reinforcement) {
            take(
                commander.id,
                firstWith(pool, (unit) => faceOf(unit).type === UnitType.Cavalry)
            )
        }
        while (sizeOf(commander.id) < commander.minimumUnits) {
            take(
                commander.id,
                firstWith(pool, (unit) => faceOf(unit).type === UnitType.Infantry)
            )
        }
    }
    if (side === Side.French && state.santon) {
        const nearest = commanders
            .filter((commander) => !offMap(commander.id))
            .reduce((best, commander) =>
                stepsFromTheSanton(state, commander.id) < stepsFromTheSanton(state, best.id)
                    ? commander
                    : best
            )
        take(
            nearest.id,
            firstWith(pool, (unit) => faceOf(unit).type === UnitType.Artillery)
        )
    }
    while (pool.length > 0) {
        const open = commanders.filter((commander) => sizeOf(commander.id) < roomFor(commander.id))
        assert(open.length > 0, 'The army does not fit its set-up locales')
        const smallest = open.reduce((best, commander) =>
            sizeOf(commander.id) < sizeOf(best.id) ? commander : best
        )
        take(smallest.id, pool[0])
    }
    const corps: CorpsDeployment[] = commanders.map((commander) =>
        offMap(commander.id)
            ? { commanderId: commander.id, unitIds: unitIdsOf(commander.id), offMap: true }
            : { commanderId: commander.id, unitIds: unitIdsOf(commander.id) }
    )
    const deployment: Deployment = { corps, detachments: [] }
    if (side !== Side.French) {
        return deployment
    }
    if (state.santon) {
        const onTheSanton = fixedBatteryOnTheSanton(state, playerId, deployment)
        assertExists(onTheSanton, 'No artillery of the suggested set-up reaches the Santon')
        return onTheSanton
    }
    for (const entry of corps) {
        const battery = entry.unitIds.find(
            (id) => faceOf(state.unit(id)).type === UnitType.Artillery
        )
        if (entry.offMap || battery === undefined) {
            continue
        }
        const [approach] = state.map.passableApproachesOf(setupLocaleId(state, entry.commanderId))
        assertExists(approach, `The fixed battery of ${entry.commanderId} has no approach to block`)
        deployment.fixedBattery = { unitId: battery, approach: approach.id }
        break
    }
    return deployment
}
