import * as Type from 'typebox'
import { assert, assertExists } from '@tabletop/common'
import { SANTON_LOCALE } from '../components/austerlitz.js'
import type { BattleMap, LocaleDefinition, LocaleId } from '../components/battleMap.js'
import {
    MAX_CORPS_UNITS,
    Side,
    UnitType,
    commanderDefinition,
    commandersOf
} from '../components/pieces.js'
import { Scenario } from '../components/timeTrack.js'
import type { HydratedNapoleonsTriumphGameState } from './gameState.js'
import { distinct, legal } from './legality.js'
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
export const ALLIED_ADVANCE_GUARD_CORPS = 2

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

export function setupLocaleOf(map: BattleMap, commanderId: string): LocaleDefinition {
    const locale = map.setupLocale(commanderId)
    assertExists(locale, `${commanderId} has no set-up locale`)
    return locale
}

function setupPosition(
    state: HydratedNapoleonsTriumphGameState,
    corps: CorpsDeployment
): Position | undefined {
    return corps.offMap
        ? undefined
        : { locale: setupLocaleOf(state.map, corps.commanderId).id, approach: corps.approach }
}

/** Rule 6, step 7: Bernadotte and Davout must each be given a unit that is not two-strength infantry. */
export function hasUnitOtherThanLineInfantry(
    state: HydratedNapoleonsTriumphGameState,
    unitIds: readonly string[]
): boolean {
    return unitIds.some((id) => {
        const face = faceOf(state.unit(id))
        return !(face.type === UnitType.Infantry && face.strength === 2)
    })
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
            distinct(assigned) &&
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
                    hasUnitOtherThanLineInfantry(state, corps.unitIds),
                    `${definition.name} needs a unit other than two-strength infantry`
                )
            }
            continue
        }
        if (corps.approach !== undefined) {
            const approach = state.map.approach(corps.approach)
            legal(
                approach.locale === setupLocaleOf(state.map, corps.commanderId).id &&
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

/** Rule 6, step 8: detached units keep out of the Allied objective locales and the locales next to them. */
export function nearAlliedObjective(
    state: HydratedNapoleonsTriumphGameState,
    locale: LocaleId
): boolean {
    return [locale, ...state.map.adjacentLocales(locale)].some((candidate) =>
        state.map.locale(candidate).stars.some((star) => ALLIED_OBJECTIVES.includes(star))
    )
}

/** Rule 6, step 8: where a unit detached from a commander on the map may stand. */
export function validateDetachedPosition(
    state: HydratedNapoleonsTriumphGameState,
    playerId: string,
    commanderId: string,
    { locale, approach }: Position
) {
    const distance = state.map.distance(setupLocaleOf(state.map, commanderId).id, locale)
    legal(
        distance !== undefined && distance <= DETACHMENT_REACH,
        'A detachment stays within two locales of its commander'
    )
    legal(!nearAlliedObjective(state, locale), 'Detachments keep clear of the Allied objectives')
    legal(!state.isEnemyOccupied(locale, playerId), 'Detachments cannot enter an enemy locale')
    if (approach !== undefined) {
        const definition = state.map.approach(approach)
        legal(
            definition.locale === locale && !definition.impassable,
            'That approach cannot be blocked'
        )
    }
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
    legal(distinct(ids), 'A unit is detached once')
    for (const detachment of deployment.detachments) {
        const corps = deployment.corps.find((candidate) =>
            candidate.unitIds.includes(detachment.unitId)
        )
        legal(corps !== undefined && !corps.offMap, 'Detachments come from corps on the map')
        const remaining = corps.unitIds.filter((id) => !ids.includes(id))
        legal(remaining.length > 0, 'A commander cannot detach its last unit')
        validateDetachedPosition(state, playerId, corps.commanderId, detachment.position)
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
    if (state.sideOf(playerId) !== Side.French) {
        legal(deployment.fixedBattery === undefined, 'There is no fixed battery to name')
        return
    }
    const battery = deployment.fixedBattery
    legal(battery !== undefined, 'The French name one battery on the map as their fixed battery')
    const placement = placed.find(
        (candidate) =>
            candidate.unit.id === battery.unitId &&
            faceOf(candidate.unit).type === UnitType.Artillery
    )
    legal(placement?.position !== undefined, 'The fixed battery is an artillery unit on the map')
    // Table ruling: with the Santon rule in use the fixed battery stands on the Santon, as it did. Rule 18 itself only says what follows if it sets up there.
    if (state.santon) {
        legal(
            placement.position.locale === SANTON_LOCALE,
            'With the Santon in use the fixed battery sets up on the Santon'
        )
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
        // Rule 6, step 9 repositions the battery only "if it is in reserve"; from an approach its corps blocks it goes elsewhere as one of the six detachments.
        legal(
            placement.position.approach === undefined,
            'The fixed battery leaves an approach its corps blocks only as a detachment'
        )
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
