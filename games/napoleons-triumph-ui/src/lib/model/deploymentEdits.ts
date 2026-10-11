import { assertExists } from '@tabletop/common'
import {
    DETACHMENT_REACH,
    MAX_FRENCH_DETACHMENTS,
    SANTON_LOCALE,
    Side,
    UnitType,
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

// Rule 6, step 9: a French set-up with artillery on the map names a fixed battery, on an approach unless it is on the Santon.
export function settleFixedBattery(
    state: HydratedNapoleonsTriumphGameState,
    side: Side,
    deployment: Deployment
): Deployment {
    if (side !== Side.French) {
        return deployment
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
    if (state.santon && locale === SANTON_LOCALE && standing === undefined) {
        return { ...deployment, fixedBattery: { unitId: battery.unitId } }
    }
    const approaches = map.passableApproachesOf(locale).map((approach) => approach.id)
    const wanted = named ? deployment.fixedBattery?.approach : undefined
    const approach =
        wanted !== undefined && approaches.includes(wanted) ? wanted : (standing ?? approaches[0])
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
