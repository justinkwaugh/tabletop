import {
    SHIPPING_STYLE_SEQUENCE,
    isShippingCompany,
    type ShippingStyle
} from '../components/company.js'
import type { HydratedIndonesiaGameState } from '../model/gameState.js'

export { SHIPPING_STYLE_SEQUENCE } from '../components/company.js'
export type { ShippingStyle } from '../components/company.js'

function sequenceIndex(style: ShippingStyle): number {
    return SHIPPING_STYLE_SEQUENCE.indexOf(style)
}

function collectOrderedShippingCompanyIdsByOwner(
    state: HydratedIndonesiaGameState,
    ignoredCompanyIds: ReadonlySet<string>
): Map<string, string[]> {
    const shippingCompanyById = new Map(
        state.companies
            .filter((company) => isShippingCompany(company) && !ignoredCompanyIds.has(company.id))
            .map((company) => [company.id, company] as const)
    )

    const companyIdsByOwner = new Map<string, string[]>()

    for (const player of state.players) {
        for (const companyId of player.ownedCompanies) {
            const company = shippingCompanyById.get(companyId)
            if (!company) {
                continue
            }

            const companyIds = companyIdsByOwner.get(company.owner) ?? []
            if (!companyIds.includes(company.id)) {
                companyIds.push(company.id)
                companyIdsByOwner.set(company.owner, companyIds)
            }
        }
    }

    for (const company of shippingCompanyById.values()) {
        const companyIds = companyIdsByOwner.get(company.owner) ?? []
        if (!companyIds.includes(company.id)) {
            companyIds.push(company.id)
            companyIdsByOwner.set(company.owner, companyIds)
        }
    }

    return companyIdsByOwner
}

function incrementStyleCount(
    styleCountsByOwner: Map<string, Map<ShippingStyle, number>>,
    globalStyleCounts: Map<ShippingStyle, number>,
    ownerId: string,
    style: ShippingStyle
): void {
    globalStyleCounts.set(style, (globalStyleCounts.get(style) ?? 0) + 1)

    const ownerCounts = styleCountsByOwner.get(ownerId) ?? new Map<ShippingStyle, number>()
    ownerCounts.set(style, (ownerCounts.get(style) ?? 0) + 1)
    styleCountsByOwner.set(ownerId, ownerCounts)
}

function preferredShippingStyle(
    ownerCounts: ReadonlyMap<ShippingStyle, number>,
    globalCounts: ReadonlyMap<ShippingStyle, number>
): ShippingStyle {
    const unusedByOwner = SHIPPING_STYLE_SEQUENCE.filter((style) => !ownerCounts.has(style))
    const candidateStyles = unusedByOwner.length > 0 ? unusedByOwner : [...SHIPPING_STYLE_SEQUENCE]

    return [...candidateStyles].sort((styleA, styleB) => {
        const ownerDelta = (ownerCounts.get(styleA) ?? 0) - (ownerCounts.get(styleB) ?? 0)
        if (ownerDelta !== 0) {
            return ownerDelta
        }

        const globalDelta = (globalCounts.get(styleA) ?? 0) - (globalCounts.get(styleB) ?? 0)
        if (globalDelta !== 0) {
            return globalDelta
        }

        return sequenceIndex(styleA) - sequenceIndex(styleB)
    })[0]
}

export function resolveShippingStyleByCompanyId(
    state: HydratedIndonesiaGameState,
    ignoredCompanyIds: Iterable<string> = []
): Map<string, ShippingStyle> {
    const ignored = new Set(ignoredCompanyIds)
    const companyIdsByOwner = collectOrderedShippingCompanyIdsByOwner(state, ignored)
    const styleByCompanyId = new Map<string, ShippingStyle>()
    const styleCountsByOwner = new Map<string, Map<ShippingStyle, number>>()
    const globalStyleCounts = new Map<ShippingStyle, number>()

    for (const company of state.companies) {
        if (!isShippingCompany(company) || ignored.has(company.id) || !company.shipStyle) {
            continue
        }

        styleByCompanyId.set(company.id, company.shipStyle)
        incrementStyleCount(styleCountsByOwner, globalStyleCounts, company.owner, company.shipStyle)
    }

    for (const [ownerId, companyIds] of companyIdsByOwner.entries()) {
        const ownerCounts = styleCountsByOwner.get(ownerId) ?? new Map<ShippingStyle, number>()

        for (const companyId of companyIds) {
            if (styleByCompanyId.has(companyId)) {
                continue
            }

            const style = preferredShippingStyle(ownerCounts, globalStyleCounts)
            styleByCompanyId.set(companyId, style)
            incrementStyleCount(styleCountsByOwner, globalStyleCounts, ownerId, style)
        }
    }

    return styleByCompanyId
}

export function chooseNewShippingStyle(
    state: HydratedIndonesiaGameState,
    ownerId: string,
    ignoredCompanyIds: Iterable<string> = []
): ShippingStyle {
    const ignored = new Set(ignoredCompanyIds)
    const styleByCompanyId = resolveShippingStyleByCompanyId(state, ignored)
    const globalStyleCounts = new Map<ShippingStyle, number>()
    const ownerStyleCounts = new Map<ShippingStyle, number>()

    for (const company of state.companies) {
        if (!isShippingCompany(company) || ignored.has(company.id)) {
            continue
        }

        const style = styleByCompanyId.get(company.id)
        if (!style) {
            continue
        }

        globalStyleCounts.set(style, (globalStyleCounts.get(style) ?? 0) + 1)
        if (company.owner === ownerId) {
            ownerStyleCounts.set(style, (ownerStyleCounts.get(style) ?? 0) + 1)
        }
    }

    return preferredShippingStyle(ownerStyleCounts, globalStyleCounts)
}

export function chooseMergedShippingStyle(
    state: HydratedIndonesiaGameState,
    winnerId: string,
    mergedCompanyIds: readonly [string, string]
): ShippingStyle {
    const winnerOwnedMergedCompanyId = state
        .getPlayerState(winnerId)
        .ownedCompanies.find((companyId) => mergedCompanyIds.includes(companyId))

    if (winnerOwnedMergedCompanyId) {
        const style = resolveShippingStyleByCompanyId(state).get(winnerOwnedMergedCompanyId)
        if (style) {
            return style
        }
    }

    return chooseNewShippingStyle(state, winnerId, mergedCompanyIds)
}
