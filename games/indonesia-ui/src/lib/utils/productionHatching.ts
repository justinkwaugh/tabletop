import {
    CompanyType,
    IndonesiaNeighborDirection,
    isIndonesiaNodeId,
    type HydratedIndonesiaGameState
} from '@tabletop/indonesia'

function addConflictEdge(
    adjacencyByCompanyId: Map<string, Set<string>>,
    companyAId: string,
    companyBId: string
): void {
    if (companyAId === companyBId) {
        return
    }

    const companyAConflicts = adjacencyByCompanyId.get(companyAId) ?? new Set<string>()
    companyAConflicts.add(companyBId)
    adjacencyByCompanyId.set(companyAId, companyAConflicts)

    const companyBConflicts = adjacencyByCompanyId.get(companyBId) ?? new Set<string>()
    companyBConflicts.add(companyAId)
    adjacencyByCompanyId.set(companyBId, companyBConflicts)
}

export function productionConflictRankByCompanyId(
    gameState: HydratedIndonesiaGameState
): Map<string, number> {
    const productionCompanyById = new Map(
        gameState.companies
            .filter((company): company is (typeof gameState.companies)[number] & { good: string } => {
                return company.type === CompanyType.Production && 'good' in company
            })
            .map((company) => [company.id, company] as const)
    )

    // Use owned-companies order as the stable chronology for hatch precedence.
    const companyIdsByOwner = new Map<string, string[]>()
    for (const player of gameState.players) {
        for (const companyId of player.ownedCompanies) {
            const company = productionCompanyById.get(companyId)
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

    for (const company of gameState.companies) {
        if (company.type !== CompanyType.Production || !('good' in company)) {
            continue
        }

        const companyIds = companyIdsByOwner.get(company.owner) ?? []
        if (!companyIds.includes(company.id)) {
            companyIds.push(company.id)
            companyIdsByOwner.set(company.owner, companyIds)
        }
    }

    const areaCompanyIdByAreaId = new Map<string, string>()
    for (const area of Object.values(gameState.board.areas)) {
        if (!('companyId' in area)) {
            continue
        }
        if (!productionCompanyById.has(area.companyId)) {
            continue
        }
        areaCompanyIdByAreaId.set(area.id, area.companyId)
    }

    const adjacencyByOwnerAndCompanyId = new Map<string, Map<string, Set<string>>>()
    for (const [owner, companyIds] of companyIdsByOwner.entries()) {
        const adjacencyByCompanyId = new Map<string, Set<string>>()
        for (const companyId of companyIds) {
            adjacencyByCompanyId.set(companyId, new Set())
        }
        adjacencyByOwnerAndCompanyId.set(owner, adjacencyByCompanyId)
    }

    // Existing behavior: production companies of the same owner/good conflict.
    for (const [owner, companyIds] of companyIdsByOwner.entries()) {
        const adjacencyByCompanyId = adjacencyByOwnerAndCompanyId.get(owner)
        if (!adjacencyByCompanyId) {
            continue
        }

        const companyIdsByGood = new Map<string, string[]>()
        for (const companyId of companyIds) {
            const company = productionCompanyById.get(companyId)
            if (!company) {
                continue
            }
            const ids = companyIdsByGood.get(company.good) ?? []
            ids.push(companyId)
            companyIdsByGood.set(company.good, ids)
        }

        for (const sameGoodCompanyIds of companyIdsByGood.values()) {
            for (let leftIndex = 0; leftIndex < sameGoodCompanyIds.length; leftIndex += 1) {
                for (
                    let rightIndex = leftIndex + 1;
                    rightIndex < sameGoodCompanyIds.length;
                    rightIndex += 1
                ) {
                    addConflictEdge(
                        adjacencyByCompanyId,
                        sameGoodCompanyIds[leftIndex],
                        sameGoodCompanyIds[rightIndex]
                    )
                }
            }
        }
    }

    // New behavior: any same-owner production companies with land-adjacent cultivated
    // areas also conflict, even across different goods.
    for (const [areaId, companyId] of areaCompanyIdByAreaId.entries()) {
        if (!isIndonesiaNodeId(areaId)) {
            continue
        }

        const company = productionCompanyById.get(companyId)
        if (!company) {
            continue
        }

        const adjacencyByCompanyId = adjacencyByOwnerAndCompanyId.get(company.owner)
        if (!adjacencyByCompanyId) {
            continue
        }

        const node = gameState.board.graph.nodeById(areaId)
        if (!node) {
            continue
        }

        for (const neighborNode of gameState.board.graph.neighborsOf(
            node,
            IndonesiaNeighborDirection.Land
        )) {
            const neighborCompanyId = areaCompanyIdByAreaId.get(neighborNode.id)
            if (!neighborCompanyId || neighborCompanyId === companyId) {
                continue
            }

            const neighborCompany = productionCompanyById.get(neighborCompanyId)
            if (!neighborCompany || neighborCompany.owner !== company.owner) {
                continue
            }

            addConflictEdge(adjacencyByCompanyId, companyId, neighborCompanyId)
        }
    }

    const companyOrderByOwnerAndId = new Map<string, number>()
    for (const [owner, companyIds] of companyIdsByOwner.entries()) {
        for (const [index, companyId] of companyIds.entries()) {
            companyOrderByOwnerAndId.set(`${owner}|${companyId}`, index)
        }
    }

    const conflictRankByCompanyId = new Map<string, number>()
    for (const [owner, adjacencyByCompanyId] of adjacencyByOwnerAndCompanyId.entries()) {
        const ownerCompanyIds = companyIdsByOwner.get(owner) ?? []
        const visitedCompanyIds = new Set<string>()

        for (const startCompanyId of ownerCompanyIds) {
            if (visitedCompanyIds.has(startCompanyId)) {
                continue
            }

            const stack = [startCompanyId]
            const connectedCompanyIds: string[] = []
            while (stack.length > 0) {
                const companyId = stack.pop()
                if (!companyId || visitedCompanyIds.has(companyId)) {
                    continue
                }

                visitedCompanyIds.add(companyId)
                connectedCompanyIds.push(companyId)

                const neighbors = adjacencyByCompanyId.get(companyId)
                if (!neighbors) {
                    continue
                }

                for (const neighborCompanyId of neighbors) {
                    if (!visitedCompanyIds.has(neighborCompanyId)) {
                        stack.push(neighborCompanyId)
                    }
                }
            }

            if (connectedCompanyIds.length <= 1) {
                continue
            }

            connectedCompanyIds.sort((leftCompanyId, rightCompanyId) => {
                const leftOrder = companyOrderByOwnerAndId.get(`${owner}|${leftCompanyId}`) ?? Number.MAX_SAFE_INTEGER
                const rightOrder = companyOrderByOwnerAndId.get(`${owner}|${rightCompanyId}`) ?? Number.MAX_SAFE_INTEGER
                if (leftOrder !== rightOrder) {
                    return leftOrder - rightOrder
                }
                return leftCompanyId.localeCompare(rightCompanyId)
            })

            for (const [index, companyId] of connectedCompanyIds.entries()) {
                conflictRankByCompanyId.set(companyId, index)
            }
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
