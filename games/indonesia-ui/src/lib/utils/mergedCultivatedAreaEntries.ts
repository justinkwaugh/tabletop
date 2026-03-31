import type { GameAction } from '@tabletop/common'
import {
    CompanyType,
    Good,
    isMergeCompanies,
    type HydratedIndonesiaGameState
} from '@tabletop/indonesia'
import { resolveLandMarkerPosition } from '$lib/utils/boardMarkers.js'

export type MergedCultivatedAreaEntry = {
    key: string
    areaId: string
    companyId: string
    ownerId: string
    good: Good
    centerX: number
    centerY: number
    opacity: number
}

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

type CultivatedAreaLike = { id: string; companyId: string; good: Good }

function isCultivatedAreaLike(area: unknown): area is CultivatedAreaLike {
    return (
        typeof area === 'object' &&
        area !== null &&
        'id' in area &&
        'companyId' in area &&
        'good' in area
    )
}

export function mergedCultivatedAreaEntriesForAction(args: {
    from: HydratedIndonesiaGameState
    to: HydratedIndonesiaGameState
    action: GameAction
}): MergedCultivatedAreaEntry[] {
    const { from, to, action } = args
    if (
        !isMergeCompanies(action) ||
        action.metadata?.proposal.companyType !== CompanyType.Production ||
        !action.metadata.proposal.isSiapSaji
    ) {
        return []
    }

    const oldCompanyIds = new Set([
        action.metadata.proposal.companyAId,
        action.metadata.proposal.companyBId
    ])
    const fromCompanyIdSet = new Set(from.companies.map((company) => company.id))
    const mergedCompany =
        to.companies.find(
            (company) =>
                company.type === CompanyType.Production &&
                company.good === Good.SiapSaji &&
                !fromCompanyIdSet.has(company.id) &&
                company.owner === action.metadata?.auctionResult.winnerId
        ) ?? null

    if (!mergedCompany || mergedCompany.type !== CompanyType.Production) {
        return []
    }

    const entries: MergedCultivatedAreaEntry[] = []

    for (const toArea of Object.values(to.board.areas) as unknown[]) {
        if (!isCultivatedAreaLike(toArea) || toArea.companyId !== mergedCompany.id || toArea.good !== Good.SiapSaji) {
            continue
        }

        const fromArea = from.board.getArea(toArea.id)
        if (!isCultivatedAreaLike(fromArea) || !oldCompanyIds.has(fromArea.companyId)) {
            continue
        }

        const center = resolveLandMarkerPosition(toArea.id)
        if (!center) {
            continue
        }

        entries.push({
            key: `merged-cultivated-${action.id}-${toArea.id}`,
            areaId: toArea.id,
            companyId: mergedCompany.id,
            ownerId: mergedCompany.owner,
            good: Good.SiapSaji,
            centerX: center.x,
            centerY: center.y,
            opacity: GROUPED_ISLAND_OVERLAY_AREA_IDS.has(toArea.id) ? 0.7 : 1
        })
    }

    return entries
}
