import { CompanyType, type HydratedIndonesiaGameState } from '@tabletop/indonesia'

const SHIPPING_STYLE_SEQUENCE = ['a', 'b', 'c'] as const

export type ShippingStyle = (typeof SHIPPING_STYLE_SEQUENCE)[number]

export function shippingStyleByCompanyId(
    gameState: HydratedIndonesiaGameState
): Map<string, ShippingStyle> {
    const shippingCompanyById = new Map(
        gameState.companies
            .filter((company) => company.type === CompanyType.Shipping)
            .map((company) => [company.id, company] as const)
    )

    const shippingCompanyIdsByOwner = new Map<string, string[]>()

    // Use owned-companies order as the stable chronology for style precedence.
    for (const player of gameState.players) {
        for (const companyId of player.ownedCompanies) {
            const company = shippingCompanyById.get(companyId)
            if (!company) {
                continue
            }

            const ownerCompanyIds = shippingCompanyIdsByOwner.get(company.owner) ?? []
            if (!ownerCompanyIds.includes(company.id)) {
                ownerCompanyIds.push(company.id)
                shippingCompanyIdsByOwner.set(company.owner, ownerCompanyIds)
            }
        }
    }

    for (const company of gameState.companies) {
        if (company.type !== CompanyType.Shipping) {
            continue
        }

        const ownerCompanyIds = shippingCompanyIdsByOwner.get(company.owner) ?? []
        if (!ownerCompanyIds.includes(company.id)) {
            ownerCompanyIds.push(company.id)
            shippingCompanyIdsByOwner.set(company.owner, ownerCompanyIds)
        }
    }

    const styleByCompanyId = new Map<string, ShippingStyle>()
    for (const companyIds of shippingCompanyIdsByOwner.values()) {
        for (const [index, companyId] of companyIds.entries()) {
            styleByCompanyId.set(companyId, SHIPPING_STYLE_SEQUENCE[index % SHIPPING_STYLE_SEQUENCE.length])
        }
    }

    return styleByCompanyId
}
