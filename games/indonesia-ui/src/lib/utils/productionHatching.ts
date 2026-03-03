import { CompanyType, type HydratedIndonesiaGameState } from '@tabletop/indonesia'

export function productionConflictRankByCompanyId(
    gameState: HydratedIndonesiaGameState
): Map<string, number> {
    const companyIdsByOwnerAndGood = new Map<string, string[]>()
    const productionCompanyById = new Map(
        gameState.companies
            .filter((company): company is (typeof gameState.companies)[number] & { good: string } => {
                return company.type === CompanyType.Production && 'good' in company
            })
            .map((company) => [company.id, company] as const)
    )

    // Use owned-companies order as the stable chronology for hatch precedence.
    for (const player of gameState.players) {
        for (const companyId of player.ownedCompanies) {
            const company = productionCompanyById.get(companyId)
            if (!company) {
                continue
            }

            const ownerAndGoodKey = `${company.owner}|${company.good}`
            const companyIds = companyIdsByOwnerAndGood.get(ownerAndGoodKey) ?? []
            if (!companyIds.includes(company.id)) {
                companyIds.push(company.id)
                companyIdsByOwnerAndGood.set(ownerAndGoodKey, companyIds)
            }
        }
    }

    for (const company of gameState.companies) {
        if (company.type !== CompanyType.Production || !('good' in company)) {
            continue
        }

        const ownerAndGoodKey = `${company.owner}|${company.good}`
        const companyIds = companyIdsByOwnerAndGood.get(ownerAndGoodKey) ?? []
        if (!companyIds.includes(company.id)) {
            companyIds.push(company.id)
            companyIdsByOwnerAndGood.set(ownerAndGoodKey, companyIds)
        }
    }

    const conflictRankByCompanyId = new Map<string, number>()
    for (const companyIds of companyIdsByOwnerAndGood.values()) {
        if (companyIds.length <= 1) {
            continue
        }

        for (const [index, companyId] of companyIds.entries()) {
            conflictRankByCompanyId.set(companyId, index)
        }
    }

    return conflictRankByCompanyId
}

export function productionHatchVariantByCompanyId(
    gameState: HydratedIndonesiaGameState,
    hatchPatternCount: number
): Map<string, number> {
    const hatchVariantByCompanyId = new Map<string, number>()
    if (hatchPatternCount <= 0) {
        return hatchVariantByCompanyId
    }

    for (const [companyId, conflictRank] of productionConflictRankByCompanyId(gameState)) {
        if (conflictRank <= 0) {
            continue
        }

        hatchVariantByCompanyId.set(companyId, (conflictRank - 1) % hatchPatternCount)
    }

    return hatchVariantByCompanyId
}
