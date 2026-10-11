import * as Type from 'typebox'
import { assert, assertExists } from '@tabletop/common'
import { SANTON_LOCALE } from '../components/austerlitz.js'
import type { LocaleDefinition, LocaleId } from '../components/battleMap.js'
import {
    MAX_CORPS_UNITS,
    Side,
    UnitType,
    commanderDefinition,
    commandersOf
} from '../components/pieces.js'
import { Scenario } from '../components/timeTrack.js'
import type { HydratedNapoleonsTriumphGameState } from './gameState.js'
import { legal } from './legality.js'
import { Position, faceOf, samePosition, type ProjectedUnit } from './pieces.js'
import { ALLIED_OBJECTIVES } from './victory.js'

export type CorpsDeployment = Type.Static<typeof CorpsDeployment>
export const CorpsDeployment = Type.Object({
    commanderId: Type.String(),
    unitIds: Type.Array(Type.String()),
    approach: Type.Optional(Type.Integer()),
    offMap: Type.Optional(Type.Literal(true))
})

export type Detachment = Type.Static<typeof Detachment>
export const Detachment = Type.Object({
    unitId: Type.String(),
    position: Position
})

export type FixedBattery = Type.Static<typeof FixedBattery>
export const FixedBattery = Type.Object({
    unitId: Type.String(),
    approach: Type.Optional(Type.Integer())
})

export type Deployment = Type.Static<typeof Deployment>
export const Deployment = Type.Object({
    corps: Type.Array(CorpsDeployment),
    detachments: Type.Array(Detachment),
    fixedBattery: Type.Optional(FixedBattery)
})

export const MAX_FRENCH_DETACHMENTS = 6
export const DETACHMENT_REACH = 2
const ALLIED_ADVANCE_GUARD_CORPS = 2

function startsOffMap(
    state: HydratedNapoleonsTriumphGameState,
    side: Side,
    corps: CorpsDeployment
): boolean {
    if (side === Side.French) {
        return commanderDefinition(corps.commanderId).reinforcement === true
    }
    return state.scenario === Scenario.December1 && corps.offMap === true
}

function setupLocaleOf(
    state: HydratedNapoleonsTriumphGameState,
    commanderId: string
): LocaleDefinition {
    const locale = state.map.setupLocale(commanderId)
    assertExists(locale, `${commanderId} has no set-up locale`)
    return locale
}

function setupPosition(
    state: HydratedNapoleonsTriumphGameState,
    corps: CorpsDeployment
): Position | undefined {
    return corps.offMap
        ? undefined
        : { locale: setupLocaleOf(state, corps.commanderId).id, approach: corps.approach }
}

function validateCorps(
    state: HydratedNapoleonsTriumphGameState,
    playerId: string,
    deployment: Deployment
) {
    const side = state.sideOf(playerId)
    const commanders = commandersOf(side)
    legal(
        deployment.corps.length === commanders.length &&
            commanders.every((definition) =>
                deployment.corps.some((corps) => corps.commanderId === definition.id)
            ),
        'Every commander of the army leads exactly one corps'
    )
    const assigned = deployment.corps.flatMap((corps) => corps.unitIds)
    const army = state.unitsOf(playerId)
    legal(
        assigned.length === army.length &&
            new Set(assigned).size === assigned.length &&
            army.every((unit) => assigned.includes(unit.id)),
        'Every unit of the army is assigned to exactly one corps'
    )
    for (const corps of deployment.corps) {
        const definition = commanderDefinition(corps.commanderId)
        legal(
            corps.unitIds.length >= definition.minimumUnits &&
                corps.unitIds.length <= MAX_CORPS_UNITS,
            `${definition.name} leads between ${definition.minimumUnits} and ${MAX_CORPS_UNITS} units`
        )
        const offMap = startsOffMap(state, side, corps)
        legal(
            offMap === (corps.offMap === true),
            `${definition.name} starts ${offMap ? 'off' : 'on'} the map`
        )
        if (offMap) {
            legal(corps.approach === undefined, 'A corps off the map has no position')
            if (side === Side.French) {
                legal(
                    corps.unitIds.some((id) => {
                        const face = faceOf(state.unit(id))
                        return !(face.type === UnitType.Infantry && face.strength === 2)
                    }),
                    `${definition.name} needs a unit other than two-strength infantry`
                )
            }
            continue
        }
        if (corps.approach !== undefined) {
            const approach = state.map.approach(corps.approach)
            legal(
                approach.locale === setupLocaleOf(state, corps.commanderId).id &&
                    !approach.impassable,
                `${definition.name} sets up in its own locale`
            )
        }
    }
    if (side === Side.Allied && state.scenario === Scenario.December1) {
        const onMap = deployment.corps.filter((corps) => !corps.offMap).length
        legal(
            onMap === ALLIED_ADVANCE_GUARD_CORPS,
            'Two Allied corps start on the map on 1 December'
        )
    }
}

function nearAlliedObjective(state: HydratedNapoleonsTriumphGameState, locale: LocaleId): boolean {
    return [locale, ...state.map.adjacentLocales(locale)].some((candidate) =>
        state.map.locale(candidate).stars.some((star) => ALLIED_OBJECTIVES.includes(star))
    )
}

function validateDetachments(
    state: HydratedNapoleonsTriumphGameState,
    playerId: string,
    deployment: Deployment
) {
    const side = state.sideOf(playerId)
    legal(
        side === Side.French || deployment.detachments.length === 0,
        'Only the French detach units during set-up'
    )
    legal(deployment.detachments.length <= MAX_FRENCH_DETACHMENTS, 'At most six units are detached')
    const ids = deployment.detachments.map((detachment) => detachment.unitId)
    legal(new Set(ids).size === ids.length, 'A unit is detached once')
    for (const detachment of deployment.detachments) {
        const corps = deployment.corps.find((candidate) =>
            candidate.unitIds.includes(detachment.unitId)
        )
        legal(corps !== undefined && !corps.offMap, 'Detachments come from corps on the map')
        const remaining = corps.unitIds.filter((id) => !ids.includes(id))
        legal(remaining.length > 0, 'A commander cannot detach its last unit')
        const home = setupLocaleOf(state, corps.commanderId)
        const { locale, approach } = detachment.position
        const distance = state.map.distance(home.id, locale)
        legal(
            distance !== undefined && distance <= DETACHMENT_REACH,
            'A detachment stays within two locales of its commander'
        )
        legal(
            !nearAlliedObjective(state, locale),
            'Detachments keep clear of the Allied objectives'
        )
        legal(!state.isEnemyOccupied(locale, playerId), 'Detachments cannot enter an enemy locale')
        if (approach !== undefined) {
            const definition = state.map.approach(approach)
            legal(
                definition.locale === locale && !definition.impassable,
                'That approach cannot be blocked'
            )
        }
    }
}

interface Placement {
    unit: ProjectedUnit
    commanderId?: string
    position?: Position
}

function placements(state: HydratedNapoleonsTriumphGameState, deployment: Deployment): Placement[] {
    return deployment.corps.flatMap((corps) =>
        corps.unitIds.map((id) => {
            const unit = state.unit(id)
            const detachment = deployment.detachments.find((candidate) => candidate.unitId === id)
            if (detachment) {
                return { unit, position: detachment.position }
            }
            return { unit, commanderId: corps.commanderId, position: setupPosition(state, corps) }
        })
    )
}

function validateFixedBattery(
    state: HydratedNapoleonsTriumphGameState,
    playerId: string,
    deployment: Deployment,
    placed: Placement[]
) {
    const artilleryOnMap = placed.filter(
        (placement) =>
            placement.position !== undefined && faceOf(placement.unit).type === UnitType.Artillery
    )
    if (state.sideOf(playerId) !== Side.French || artilleryOnMap.length === 0) {
        legal(deployment.fixedBattery === undefined, 'There is no fixed battery to name')
        return
    }
    const battery = deployment.fixedBattery
    legal(battery !== undefined, 'The French name one battery on the map as their fixed battery')
    const placement = artilleryOnMap.find((candidate) => candidate.unit.id === battery.unitId)
    legal(placement?.position !== undefined, 'The fixed battery is an artillery unit on the map')
    const onSanton = state.santon && placement.position.locale === SANTON_LOCALE
    if (onSanton) {
        legal(
            placement.position.approach === undefined && battery.approach === undefined,
            'A fixed battery on the Santon sets up in reserve'
        )
        return
    }
    const approachId = battery.approach ?? placement.position.approach
    legal(approachId !== undefined, 'The fixed battery blocks an approach')
    const approach = state.map.approach(approachId)
    legal(
        approach.locale === placement.position.locale && !approach.impassable,
        'The fixed battery blocks an approach of the locale it sets up in'
    )
    if (
        placement.commanderId !== undefined &&
        battery.approach !== undefined &&
        battery.approach !== placement.position.approach
    ) {
        const corps = placed.filter((candidate) => candidate.commanderId === placement.commanderId)
        legal(corps.length > 1, 'A commander cannot detach its last unit')
    }
}

/** Rule 6, steps 6 to 9. */
export function deployArmy(
    state: HydratedNapoleonsTriumphGameState,
    playerId: string,
    deployment: Deployment
) {
    validateCorps(state, playerId, deployment)
    validateDetachments(state, playerId, deployment)
    const placed = placements(state, deployment)
    validateFixedBattery(state, playerId, deployment, placed)

    const battery = deployment.fixedBattery
    for (const placement of placed) {
        const { unit } = placement
        unit.commanderId = placement.commanderId
        unit.position = placement.position ? { ...placement.position } : undefined
        if (battery?.unitId === unit.id && unit.position !== undefined) {
            unit.fixed = true
            if (battery.approach !== undefined && battery.approach !== unit.position.approach) {
                unit.position = { locale: unit.position.locale, approach: battery.approach }
                unit.commanderId = undefined
            }
            state.reveal(unit)
        }
    }
    for (const corps of deployment.corps) {
        const commander = state.commander(corps.commanderId)
        commander.position = setupPosition(state, corps)
        const members = state.corpsUnits(commander.id)
        assert(members.length > 0, 'A corps can never be just a commander')
        assert(
            members.every(
                (unit) =>
                    samePosition(unit.position, commander.position) ||
                    (unit.position === undefined && commander.position === undefined)
            ),
            'The pieces of a corps stand together'
        )
    }
    for (const locale of new Set(placed.flatMap((placement) => placement.position?.locale ?? []))) {
        legal(
            state.unitsIn(locale, playerId).length <= state.map.locale(locale).capacity,
            `Locale ${locale} cannot hold that many units`
        )
    }
}

function firstWith(
    pool: ProjectedUnit[],
    match: (unit: ProjectedUnit) => boolean
): ProjectedUnit | undefined {
    return pool.find(match) ?? pool[0]
}

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
            : Math.min(MAX_CORPS_UNITS, setupLocaleOf(state, commanderId).capacity)
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
    for (const entry of corps) {
        const battery = entry.unitIds.find(
            (id) => faceOf(state.unit(id)).type === UnitType.Artillery
        )
        if (entry.offMap || battery === undefined) {
            continue
        }
        const locale = setupLocaleOf(state, entry.commanderId)
        const onSanton = state.santon && locale.id === SANTON_LOCALE
        deployment.fixedBattery = onSanton
            ? { unitId: battery }
            : { unitId: battery, approach: state.map.passableApproachesOf(locale.id)[0].id }
        break
    }
    return deployment
}
