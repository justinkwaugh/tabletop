import { assertExists } from '@tabletop/common'
import {
    DETACHMENT_REACH,
    MAX_FRENCH_DETACHMENTS,
    SANTON_LOCALE,
    Side,
    UnitType,
    approachTowardsEnemy,
    deployArmy,
    isLegal,
    whyIllegal,
    type BattleMap,
    type Deployment,
    type HydratedNapoleonsTriumphGameState,
    type LocaleDefinition,
    type Position
} from '@tabletop/napoleons-triumph'
import { copyOf } from './stateCopy.js'
import {
    approachTarget,
    reserveTarget,
    type ApproachTarget,
    type ReserveTarget
} from './targets.js'

export function setupLocaleOf(map: BattleMap, commanderId: string): LocaleDefinition {
    const locale = map.setupLocale(commanderId)
    assertExists(locale, `${commanderId} has no set-up locale`)
    return locale
}

export interface DeploymentPreview {
    state?: HydratedNapoleonsTriumphGameState
    problem?: string
}

export function previewDeployment(
    state: HydratedNapoleonsTriumphGameState,
    playerId: string,
    deployment: Deployment
): DeploymentPreview {
    const deployed = copyOf(state)
    const problem = whyIllegal(() => deployArmy(deployed, playerId, deployment))
    return problem === undefined ? { state: deployed } : { problem }
}

// Table ruling: with the Santon rule in use the fixed battery stands on the Santon, in reserve. No corps sets up there, so the artillery unit is detached to it from a corps within reach, the one named if it can be.
function settleOnTheSanton(
    state: HydratedNapoleonsTriumphGameState,
    deployment: Deployment
): Deployment | undefined {
    const map = state.map
    const stepsFromTheSanton = (commanderId: string): number =>
        map.distance(setupLocaleOf(map, commanderId).id, SANTON_LOCALE) ?? Infinity
    const withinReach = deployment.corps
        .filter(
            (corps) => !corps.offMap && stepsFromTheSanton(corps.commanderId) <= DETACHMENT_REACH
        )
        .toSorted((a, b) => stepsFromTheSanton(a.commanderId) - stepsFromTheSanton(b.commanderId))
        .flatMap((corps) => corps.unitIds)
        .filter((unitId) => state.unit(unitId).face?.type === UnitType.Artillery)
    const named = deployment.fixedBattery?.unitId
    const unitId = named !== undefined && withinReach.includes(named) ? named : withinReach[0]
    if (unitId === undefined) {
        return undefined
    }
    return {
        ...deployment,
        detachments: [
            ...deployment.detachments.filter((entry) => entry.unitId !== unitId),
            { unitId, position: { locale: SANTON_LOCALE } }
        ],
        fixedBattery: { unitId }
    }
}

// Rule 6, step 9: a French set-up with artillery on the map names a fixed battery, on an approach unless it is on the Santon.
export function settleFixedBattery(
    state: HydratedNapoleonsTriumphGameState,
    side: Side,
    deployment: Deployment
): Deployment {
    if (side !== Side.French) {
        return deployment
    }
    const onTheSanton = state.santon ? settleOnTheSanton(state, deployment) : undefined
    if (onTheSanton) {
        return onTheSanton
    }
    const map = state.map
    const gunsOnMap = deployment.corps
        .filter((corps) => !corps.offMap)
        .flatMap((corps) => corps.unitIds.map((unitId) => ({ unitId, corps })))
        .filter(({ unitId }) => state.unit(unitId).face?.type === UnitType.Artillery)
    const named = gunsOnMap.find(({ unitId }) => unitId === deployment.fixedBattery?.unitId)
    const battery = named ?? gunsOnMap[0]
    if (!battery) {
        return { ...deployment, fixedBattery: undefined }
    }
    const detachment = deployment.detachments.find((entry) => entry.unitId === battery.unitId)
    const locale = detachment?.position.locale ?? setupLocaleOf(map, battery.corps.commanderId).id
    const standing = detachment ? detachment.position.approach : battery.corps.approach
    const approaches = map.passableApproachesOf(locale).map((approach) => approach.id)
    // Guns detached onto an approach stand where the player put them, whatever approach was named for them before.
    const posted = detachment !== undefined && standing !== undefined
    const wanted = named && !posted ? deployment.fixedBattery?.approach : undefined
    const approach =
        wanted !== undefined && approaches.includes(wanted)
            ? wanted
            : (standing ??
              approachTowardsEnemy(state, state.playerOf(Side.French).playerId, locale).id)
    return {
        ...deployment,
        fixedBattery: {
            unitId: battery.unitId,
            approach: standing === approach ? undefined : approach
        }
    }
}

export function withUnitAssigned(
    deployment: Deployment,
    unitId: string,
    commanderId: string
): Deployment {
    return {
        ...deployment,
        corps: deployment.corps.map((corps) => ({
            ...corps,
            unitIds:
                corps.commanderId === commanderId
                    ? [...corps.unitIds.filter((id) => id !== unitId), unitId]
                    : corps.unitIds.filter((id) => id !== unitId)
        })),
        detachments: deployment.detachments.filter((entry) => entry.unitId !== unitId)
    }
}

export function withDetachmentRecalled(deployment: Deployment, unitId: string): Deployment {
    return {
        ...deployment,
        detachments: deployment.detachments.filter((entry) => entry.unitId !== unitId)
    }
}

export function withUnitDetached(
    deployment: Deployment,
    unitId: string,
    position: Position
): Deployment {
    return {
        ...deployment,
        detachments: [
            ...withDetachmentRecalled(deployment, unitId).detachments,
            { unitId, position }
        ]
    }
}

export function withCorpsStance(
    deployment: Deployment,
    commanderId: string,
    approach: number | undefined
): Deployment {
    return {
        ...deployment,
        corps: deployment.corps.map((corps) =>
            corps.commanderId === commanderId ? { ...corps, approach } : corps
        )
    }
}

/** Rule 6: a corps sets up in its own locale, in reserve or blocking one of its approaches. */
export function stanceTargets(
    map: BattleMap,
    deployment: Deployment,
    commanderId: string
): (ReserveTarget | ApproachTarget)[] {
    const corps = deployment.corps.find((entry) => entry.commanderId === commanderId)
    assertExists(corps, `${commanderId} leads no corps of the set-up`)
    if (corps.offMap) {
        return []
    }
    const locale = setupLocaleOf(map, commanderId).id
    const approaches = map
        .passableApproachesOf(locale)
        .filter((approach) => approach.id !== corps.approach)
        .map((approach) => approachTarget({ locale, approach: approach.id }))
    return corps.approach === undefined ? approaches : [reserveTarget(locale), ...approaches]
}

export function withCorpsOffMapToggled(deployment: Deployment, commanderId: string): Deployment {
    return {
        ...deployment,
        corps: deployment.corps.map((corps) => {
            if (corps.commanderId !== commanderId) {
                return corps
            }
            return corps.offMap
                ? { commanderId: corps.commanderId, unitIds: corps.unitIds }
                : { commanderId: corps.commanderId, unitIds: corps.unitIds, offMap: true as const }
        })
    }
}

export function withBatteryFixed(deployment: Deployment, unitId: string): Deployment {
    return { ...deployment, fixedBattery: { unitId } }
}

/** Names other artillery as the fixed battery; with the Santon rule in use the unit it replaces goes back to its corps from the Santon. */
export function withBatteryNamed(
    state: HydratedNapoleonsTriumphGameState,
    deployment: Deployment,
    unitId: string
): Deployment {
    const replaced = deployment.fixedBattery?.unitId
    return withBatteryFixed(
        state.santon && replaced !== undefined
            ? withDetachmentRecalled(deployment, replaced)
            : deployment,
        unitId
    )
}

export function mayNameFixedBattery(
    state: HydratedNapoleonsTriumphGameState,
    deployment: Deployment,
    unitId: string
): boolean {
    return (
        deployment.fixedBattery?.unitId !== unitId &&
        settleFixedBattery(state, Side.French, withBatteryNamed(state, deployment, unitId))
            .fixedBattery?.unitId === unitId
    )
}

function fixedBatteryLocale(map: BattleMap, deployment: Deployment): number | undefined {
    const battery = deployment.fixedBattery
    if (!battery) {
        return undefined
    }
    const detachment = deployment.detachments.find((entry) => entry.unitId === battery.unitId)
    if (detachment) {
        return detachment.position.locale
    }
    const corps = deployment.corps.find((entry) => entry.unitIds.includes(battery.unitId))
    return corps && !corps.offMap ? setupLocaleOf(map, corps.commanderId).id : undefined
}

/** Rule 6, step 9: the fixed battery blocks an approach of the locale it sets up in, which is no detachment. */
export function withFixedBatteryOn(deployment: Deployment, approach: number): Deployment {
    const battery = deployment.fixedBattery
    assertExists(battery, 'Only a set-up that names a fixed battery can aim it')
    const detached = deployment.detachments.some((entry) => entry.unitId === battery.unitId)
    if (!detached) {
        return { ...deployment, fixedBattery: { unitId: battery.unitId, approach } }
    }
    return {
        ...deployment,
        detachments: deployment.detachments.map((entry) =>
            entry.unitId === battery.unitId
                ? { unitId: entry.unitId, position: { locale: entry.position.locale, approach } }
                : entry
        ),
        fixedBattery: { unitId: battery.unitId }
    }
}

export function fixedBatteryTargets(
    state: HydratedNapoleonsTriumphGameState,
    playerId: string,
    deployment: Deployment
): ApproachTarget[] {
    const locale = fixedBatteryLocale(state.map, deployment)
    if (locale === undefined || state.santon) {
        return []
    }
    const standsOn = previewDeployment(state, playerId, deployment).state?.unit(
        deployment.fixedBattery?.unitId ?? ''
    ).position?.approach
    return state.map
        .passableApproachesOf(locale)
        .filter((approach) => approach.id !== standsOn)
        .filter((approach) =>
            isLegal(() =>
                deployArmy(
                    copyOf(state),
                    playerId,
                    settleFixedBattery(
                        state,
                        Side.French,
                        withFixedBatteryOn(deployment, approach.id)
                    )
                )
            )
        )
        .map((approach) => approachTarget({ locale, approach: approach.id }))
}

/** Where the unit picked in the roster may be sent: the fixed battery to another approach of its own locale, any French unit to a detached post. */
export function unitTargets(
    state: HydratedNapoleonsTriumphGameState,
    playerId: string,
    deployment: Deployment,
    unitId: string
): (ReserveTarget | ApproachTarget)[] {
    const posts = detachmentTargets(state, playerId, deployment, unitId)
    if (deployment.fixedBattery?.unitId !== unitId) {
        return posts
    }
    if (state.santon) {
        return []
    }
    const locale = fixedBatteryLocale(state.map, deployment)
    return [
        ...fixedBatteryTargets(state, playerId, deployment),
        ...posts.filter((target) => target.position.locale !== locale)
    ]
}

export function withUnitSentTo(
    map: BattleMap,
    deployment: Deployment,
    unitId: string,
    position: Position
): Deployment {
    const aimsBattery =
        deployment.fixedBattery?.unitId === unitId &&
        position.approach !== undefined &&
        position.locale === fixedBatteryLocale(map, deployment)
    return aimsBattery && position.approach !== undefined
        ? withFixedBatteryOn(deployment, position.approach)
        : withUnitDetached(deployment, unitId, position)
}

function mayDetachTo(
    state: HydratedNapoleonsTriumphGameState,
    playerId: string,
    deployment: Deployment,
    unitId: string,
    position: Position
): boolean {
    const detached: Deployment = {
        ...withUnitDetached(deployment, unitId, position),
        fixedBattery:
            deployment.fixedBattery?.unitId === unitId ? undefined : deployment.fixedBattery
    }
    return isLegal(() =>
        deployArmy(copyOf(state), playerId, settleFixedBattery(state, Side.French, detached))
    )
}

export function detachmentTargets(
    state: HydratedNapoleonsTriumphGameState,
    playerId: string,
    deployment: Deployment,
    unitId: string
): (ReserveTarget | ApproachTarget)[] {
    if (state.sideOf(playerId) !== Side.French) {
        return []
    }
    const corps = deployment.corps.find((entry) => entry.unitIds.includes(unitId))
    assertExists(corps, `${unitId} is in no corps of the set-up`)
    const alreadyDetached = deployment.detachments.some((entry) => entry.unitId === unitId)
    const detachmentsLeft =
        alreadyDetached || deployment.detachments.length < MAX_FRENCH_DETACHMENTS
    if (corps.offMap || !detachmentsLeft) {
        return []
    }
    const map = state.map
    const home = setupLocaleOf(map, corps.commanderId)
    return map.allLocales
        .filter((locale) => (map.distance(home.id, locale.id) ?? Infinity) <= DETACHMENT_REACH)
        .flatMap((locale) => [
            reserveTarget(locale.id),
            ...map
                .passableApproachesOf(locale.id)
                .map((approach) => approachTarget({ locale: locale.id, approach: approach.id }))
        ])
        .filter((target) => mayDetachTo(state, playerId, deployment, unitId, target.position))
}
