import type { GameAction, Point } from '@tabletop/common'
import { Color } from '@tabletop/common'
import {
    CompanyType,
    Deeds,
    Good,
    INDONESIA_REGIONS,
    isExpand,
    isStartCompany,
    type HydratedIndonesiaGameState,
    type IndonesiaNodeId,
    type ProductionDeed,
} from '@tabletop/indonesia'
import { PRODUCTION_ZONE_MARKER_OFFSETS } from '$lib/definitions/productionZoneMarkerOffsets.js'
import { resolveLandMarkerPosition } from '$lib/utils/boardMarkers.js'
import { productionHatchVariantByCompanyId } from '$lib/utils/productionHatching.js'
import { resolveProductionZoneBoundaryTarget } from '$lib/utils/productionZoneMarkerBoundary.js'
import { markerPointsForSeaAreaShipList } from '$lib/utils/shipMarkers.js'
import { shadeHexColor } from '$lib/utils/color.js'
import { shippingStyleByCompanyId, type ShippingStyle } from '$lib/utils/shippingStyles.js'

export type StartedMarkerGood = 'spice' | 'siapsaji' | 'oil' | 'rice' | 'rubber'
export type StartedMarkerDirection = 'north' | 'east' | 'south' | 'west'

export type StartedProductionZoneMarkerEntry = {
    key: string
    companyId: string
    deedId: string
    x: number
    y: number
    targetX: number
    targetY: number
    ownerColor: string
    goodType: StartedMarkerGood
    goodsCount: number
    hatchPatternId: string | null
    direction: StartedMarkerDirection
}

export type StartedCultivatedAreaEntry = {
    key: string
    areaId: string
    companyId: string
    ownerColor: string
    good: Good
    centerX: number
    centerY: number
    opacity: number
}

export type StartedShipMarkerEntry = {
    key: string
    areaId: string
    companyId: string
    x: number
    y: number
    style: ShippingStyle
    ownerColor: string
    ownerStrokeColor: string
    remainingCapacity?: number
    capacityBadgeTextColor: string
}

const BOARD_WIDTH = 2646
const BOARD_HEIGHT = 1280
const BOARD_CENTER: Point = { x: BOARD_WIDTH / 2, y: BOARD_HEIGHT / 2 }
const EDGE_PADDING = 68
const BASE_OFFSET_DISTANCE = 100
const RADIAL_STEP_DISTANCE = 18
const LATERAL_SPREAD_DISTANCE = 62
const HATCH_PATTERN_IDS = [
    'cultivated-hatch-diag-0',
    'cultivated-hatch-diag-1',
    'cultivated-hatch-diag-2',
    'cultivated-hatch-diag-3'
] as const
const SHIP_MARKER_HULL_STROKE_DARKNESS_SHIFT_YELLOW = 0.16
const SHIP_MARKER_HULL_STROKE_DARKNESS_SHIFT_BLUE = 0.12
const GROUPED_ISLAND_OVERLAY_AREA_IDS = new Set([
    'A05',
    'A09',
    'A26',
    'D13',
    'C18',
    'C19',
    'C20',
    'F06',
    'F07'
])

const productionDeedSlotById = (() => {
    const slotById = new Map<string, { index: number; count: number }>()
    const productionDeeds = Deeds.filter(
        (deed): deed is ProductionDeed => deed.type === CompanyType.Production
    ).sort((left, right) => {
        if (left.region !== right.region) {
            return left.region.localeCompare(right.region, undefined, { numeric: true })
        }
        return left.id.localeCompare(right.id, undefined, { numeric: true })
    })

    const deedIdsByRegion = new Map<string, string[]>()
    for (const deed of productionDeeds) {
        const deedIds = deedIdsByRegion.get(deed.region) ?? []
        deedIds.push(deed.id)
        deedIdsByRegion.set(deed.region, deedIds)
    }

    for (const deedIds of deedIdsByRegion.values()) {
        const count = deedIds.length
        for (const [index, deedId] of deedIds.entries()) {
            slotById.set(deedId, { index, count })
        }
    }

    return slotById
})()

const regionCenterById = new Map<string, Point>(
    INDONESIA_REGIONS.map((region) => {
        const points = region.areaIds
            .map((areaId) => resolveLandMarkerPosition(areaId))
            .filter((point): point is Point => point !== null)
        return [region.id, averagePoint(points) ?? BOARD_CENTER] as const
    })
)

function averagePoint(points: readonly Point[]): Point | null {
    if (points.length === 0) {
        return null
    }

    let x = 0
    let y = 0
    for (const point of points) {
        x += point.x
        y += point.y
    }

    return { x: x / points.length, y: y / points.length }
}

function clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value))
}

function directionTowardTarget(
    markerX: number,
    markerY: number,
    targetX: number,
    targetY: number
): StartedMarkerDirection {
    const deltaX = targetX - markerX
    const deltaY = targetY - markerY
    return Math.abs(deltaX) >= Math.abs(deltaY)
        ? deltaX >= 0
            ? 'east'
            : 'west'
        : deltaY >= 0
          ? 'south'
          : 'north'
}

function asMarkerGood(good: Good): StartedMarkerGood {
    if (good === Good.Rice) {
        return 'rice'
    }
    if (good === Good.Spice) {
        return 'spice'
    }
    if (good === Good.Rubber) {
        return 'rubber'
    }
    if (good === Good.Oil) {
        return 'oil'
    }
    return 'siapsaji'
}

export function startedProductionZoneMarkerEntryForAction(args: {
    gameState: HydratedIndonesiaGameState
    action: GameAction
    ownerColor: string
}): StartedProductionZoneMarkerEntry | null {
    const { gameState, action, ownerColor } = args
    if (!isStartCompany(action) || action.metadata?.company?.type !== CompanyType.Production) {
        return null
    }

    const company = action.metadata.company
    const deed = company.deeds[0]
    if (!deed || deed.type !== CompanyType.Production) {
        return null
    }

    const zoneCenter = resolveLandMarkerPosition(action.areaId)
    if (!zoneCenter) {
        return null
    }

    const anchorPoint = regionCenterById.get(deed.region) ?? zoneCenter
    const slot = productionDeedSlotById.get(deed.id)
    const centeredIndex =
        slot !== undefined
            ? slot.index - (slot.count - 1) / 2
            : 0

    let directionX = anchorPoint.x - BOARD_CENTER.x
    let directionY = anchorPoint.y - BOARD_CENTER.y
    const directionMagnitude = Math.hypot(directionX, directionY)
    if (directionMagnitude > 0.001) {
        directionX /= directionMagnitude
        directionY /= directionMagnitude
    } else {
        directionX = 0
        directionY = -1
    }

    const tangentX = -directionY
    const tangentY = directionX
    const radialDistance =
        BASE_OFFSET_DISTANCE + Math.floor(Math.abs(centeredIndex)) * RADIAL_STEP_DISTANCE
    const lateralDistance = centeredIndex * LATERAL_SPREAD_DISTANCE

    const staticOffset = PRODUCTION_ZONE_MARKER_OFFSETS[deed.id as keyof typeof PRODUCTION_ZONE_MARKER_OFFSETS] ?? {
        x: 0,
        y: 0
    }

    const x = clamp(
        anchorPoint.x + directionX * radialDistance + tangentX * lateralDistance + staticOffset.x,
        EDGE_PADDING,
        BOARD_WIDTH - EDGE_PADDING
    )
    const y = clamp(
        anchorPoint.y + directionY * radialDistance + tangentY * lateralDistance + staticOffset.y,
        EDGE_PADDING,
        BOARD_HEIGHT - EDGE_PADDING
    )

    const hatchVariantByCompanyId = productionHatchVariantByCompanyId(
        gameState,
        HATCH_PATTERN_IDS.length
    )
    const hatchVariant = hatchVariantByCompanyId.get(company.id)
    const boundaryTarget = resolveProductionZoneBoundaryTarget(
        { x, y },
        [action.areaId],
        zoneCenter
    )

    return {
        key: `started-production-${company.id}`,
        companyId: company.id,
        deedId: deed.id,
        x,
        y,
        targetX: boundaryTarget.x,
        targetY: boundaryTarget.y,
        ownerColor,
        goodType: asMarkerGood(company.good),
        goodsCount: 1,
        hatchPatternId: hatchVariant === undefined ? null : HATCH_PATTERN_IDS[hatchVariant],
        direction: directionTowardTarget(x, y, boundaryTarget.x, boundaryTarget.y)
    }
}

export function startedCultivatedAreaEntryForAction(args: {
    action: GameAction
    ownerColor: string
}): StartedCultivatedAreaEntry | null {
    const { action, ownerColor } = args
    if (!isStartCompany(action) || action.metadata?.company?.type !== CompanyType.Production) {
        return null
    }

    const areaCenter = resolveLandMarkerPosition(action.areaId)
    if (!areaCenter) {
        return null
    }

    return {
        key: `started-cultivated-${action.metadata.company.id}-${action.areaId}`,
        areaId: action.areaId,
        companyId: action.metadata.company.id,
        ownerColor,
        good: action.metadata.company.good,
        centerX: areaCenter.x,
        centerY: areaCenter.y,
        opacity: GROUPED_ISLAND_OVERLAY_AREA_IDS.has(action.areaId) ? 0.7 : 1
    }
}

export function startedShipMarkerEntryForAction(args: {
    gameState: HydratedIndonesiaGameState
    action: GameAction
    ownerColor: string
    ownerPlayerColor: Color
}): StartedShipMarkerEntry | null {
    const { gameState, action, ownerColor, ownerPlayerColor } = args
    if (!isStartCompany(action) || action.metadata?.company?.type !== CompanyType.Shipping) {
        return null
    }

    const company = action.metadata.company
    const seaArea = gameState.board.getArea(action.areaId)
    if (!('ships' in seaArea)) {
        return null
    }

    const simulatedShips = [...seaArea.ships, company.id]
    const points = markerPointsForSeaAreaShipList(seaArea.id, simulatedShips)
    const markerIndex = simulatedShips.length - 1
    if (markerIndex < 0 || markerIndex >= points.length) {
        return null
    }

    const style = company.shipStyle ?? 'a'
    const ownerHullLevel = gameState.getPlayerState(company.owner).research.hull
    const capacityPerShip = 1 + ownerHullLevel
    const usedCapacity = 0
    const companyShipOrdinal = 0

    return {
        key: `started-ship-${company.id}-${seaArea.id}`,
        areaId: seaArea.id,
        companyId: company.id,
        x: points[markerIndex].x,
        y: points[markerIndex].y,
        style,
        ownerColor,
        remainingCapacity: Math.max(
            0,
            Math.min(capacityPerShip, (companyShipOrdinal + 1) * capacityPerShip - usedCapacity)
        ),
        capacityBadgeTextColor: ownerPlayerColor === Color.Yellow ? '#111827' : '#f8fafc',
        ownerStrokeColor:
            ownerPlayerColor === Color.Yellow
                ? shadeHexColor(ownerColor, SHIP_MARKER_HULL_STROKE_DARKNESS_SHIFT_YELLOW)
                : ownerPlayerColor === Color.Blue
                  ? shadeHexColor(ownerColor, SHIP_MARKER_HULL_STROKE_DARKNESS_SHIFT_BLUE)
                  : 'none'
    }
}

export function expandedCultivatedAreaEntryForAction(args: {
    gameState: HydratedIndonesiaGameState
    action: GameAction
    ownerColor: string
}): StartedCultivatedAreaEntry | null {
    const { gameState, action, ownerColor } = args
    if (!isExpand(action)) {
        return null
    }

    const operatingCompanyId = gameState.operatingCompanyId
    if (!operatingCompanyId) {
        return null
    }

    const company = gameState.companies.find((entry) => entry.id === operatingCompanyId)
    if (!company || company.type !== CompanyType.Production) {
        return null
    }

    const areaCenter = resolveLandMarkerPosition(action.areaId)
    if (!areaCenter) {
        return null
    }

    return {
        key: `expanded-cultivated-${company.id}-${action.areaId}`,
        areaId: action.areaId,
        companyId: company.id,
        ownerColor,
        good: company.good,
        centerX: areaCenter.x,
        centerY: areaCenter.y,
        opacity: GROUPED_ISLAND_OVERLAY_AREA_IDS.has(action.areaId) ? 0.7 : 1
    }
}

export function expandedShipMarkerEntryForAction(args: {
    gameState: HydratedIndonesiaGameState
    action: GameAction
    ownerColor: string
    ownerPlayerColor: Color
}): StartedShipMarkerEntry | null {
    const { gameState, action, ownerColor, ownerPlayerColor } = args
    if (!isExpand(action)) {
        return null
    }

    const operatingCompanyId = gameState.operatingCompanyId
    if (!operatingCompanyId) {
        return null
    }

    const company = gameState.companies.find((entry) => entry.id === operatingCompanyId)
    if (!company || company.type !== CompanyType.Shipping) {
        return null
    }

    const seaArea = gameState.board.getArea(action.areaId)
    if (!('ships' in seaArea)) {
        return null
    }

    const simulatedShips = [...seaArea.ships, company.id]
    const points = markerPointsForSeaAreaShipList(seaArea.id, simulatedShips)
    const markerIndex = simulatedShips.length - 1
    if (markerIndex < 0 || markerIndex >= points.length) {
        return null
    }

    const style = shippingStyleByCompanyId(gameState).get(company.id) ?? 'a'
    const ownerHullLevel = gameState.getPlayerState(company.owner).research.hull
    const capacityPerShip = 1 + ownerHullLevel
    const usedCapacity = gameState.operatingCompanyShipUseCount(company.id, seaArea.id as IndonesiaNodeId)
    const companyShipOrdinal = simulatedShips
        .slice(0, markerIndex + 1)
        .filter((companyId: string) => companyId === company.id).length - 1

    return {
        key: `expanded-ship-${company.id}-${seaArea.id}-${markerIndex}`,
        areaId: seaArea.id,
        companyId: company.id,
        x: points[markerIndex].x,
        y: points[markerIndex].y,
        style,
        ownerColor,
        remainingCapacity: Math.max(
            0,
            Math.min(capacityPerShip, (companyShipOrdinal + 1) * capacityPerShip - usedCapacity)
        ),
        capacityBadgeTextColor: ownerPlayerColor === Color.Yellow ? '#111827' : '#f8fafc',
        ownerStrokeColor:
            ownerPlayerColor === Color.Yellow
                ? shadeHexColor(ownerColor, SHIP_MARKER_HULL_STROKE_DARKNESS_SHIFT_YELLOW)
                : ownerPlayerColor === Color.Blue
                  ? shadeHexColor(ownerColor, SHIP_MARKER_HULL_STROKE_DARKNESS_SHIFT_BLUE)
                  : 'none'
    }
}
