import {
    CompanyType,
    IndonesiaNeighborDirection,
    isIndonesiaNodeId,
    type HydratedIndonesiaGameState
} from '@tabletop/indonesia'

export type ProductionHatchMode = 'player' | 'goods'

type ProductionHatchOptions = {
    mode?: ProductionHatchMode
}

type ProductionCompany = (HydratedIndonesiaGameState['companies'][number] & { good: string }) & {
    type: CompanyType.Production
}

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

function productionCompanyById(gameState: HydratedIndonesiaGameState): Map<string, ProductionCompany> {
    return new Map(
        gameState.companies
            .filter((company): company is ProductionCompany => {
                return company.type === CompanyType.Production && 'good' in company
            })
            .map((company) => [company.id, company] as const)
    )
}

function productionCompanyOrderById(
    gameState: HydratedIndonesiaGameState,
    companyById: ReadonlyMap<string, ProductionCompany>
): Map<string, number> {
    const orderByCompanyId = new Map<string, number>()
    let index = 0

    for (const player of gameState.players) {
        for (const companyId of player.ownedCompanies) {
            if (!companyById.has(companyId) || orderByCompanyId.has(companyId)) {
                continue
            }
            orderByCompanyId.set(companyId, index)
            index += 1
        }
    }

    for (const company of gameState.companies) {
        if (!companyById.has(company.id) || orderByCompanyId.has(company.id)) {
            continue
        }
        orderByCompanyId.set(company.id, index)
        index += 1
    }

    return orderByCompanyId
}

function productionAreaCompanyIdByAreaId(
    gameState: HydratedIndonesiaGameState,
    companyById: ReadonlyMap<string, ProductionCompany>
): Map<string, string> {
    const areaCompanyIdByAreaId = new Map<string, string>()
    for (const area of Object.values(gameState.board.areas)) {
        if (!('companyId' in area) || !companyById.has(area.companyId)) {
            continue
        }
        areaCompanyIdByAreaId.set(area.id, area.companyId)
    }
    return areaCompanyIdByAreaId
}

function applyPlayerModeConflicts(
    gameState: HydratedIndonesiaGameState,
    companyById: ReadonlyMap<string, ProductionCompany>,
    areaCompanyIdByAreaId: ReadonlyMap<string, string>,
    adjacencyByCompanyId: Map<string, Set<string>>
): void {
    const companyIdsByOwner = new Map<string, string[]>()
    for (const company of companyById.values()) {
        const companyIds = companyIdsByOwner.get(company.owner) ?? []
        companyIds.push(company.id)
        companyIdsByOwner.set(company.owner, companyIds)
    }

    // Same-owner/same-good companies always conflict.
    for (const companyIds of companyIdsByOwner.values()) {
        const companyIdsByGood = new Map<string, string[]>()
        for (const companyId of companyIds) {
            const company = companyById.get(companyId)
            if (!company) {
                continue
            }
            const sameGoodIds = companyIdsByGood.get(company.good) ?? []
            sameGoodIds.push(companyId)
            companyIdsByGood.set(company.good, sameGoodIds)
        }

        for (const sameGoodIds of companyIdsByGood.values()) {
            for (let leftIndex = 0; leftIndex < sameGoodIds.length; leftIndex += 1) {
                for (let rightIndex = leftIndex + 1; rightIndex < sameGoodIds.length; rightIndex += 1) {
                    addConflictEdge(
                        adjacencyByCompanyId,
                        sameGoodIds[leftIndex],
                        sameGoodIds[rightIndex]
                    )
                }
            }
        }
    }

    // Same-owner cultivated areas that become land-adjacent also conflict.
    for (const [areaId, companyId] of areaCompanyIdByAreaId.entries()) {
        if (!isIndonesiaNodeId(areaId)) {
            continue
        }

        const company = companyById.get(companyId)
        if (!company) {
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

            const neighborCompany = companyById.get(neighborCompanyId)
            if (!neighborCompany || neighborCompany.owner !== company.owner) {
                continue
            }

            addConflictEdge(adjacencyByCompanyId, companyId, neighborCompanyId)
        }
    }
}

function applyGoodsModeConflicts(
    gameState: HydratedIndonesiaGameState,
    companyById: ReadonlyMap<string, ProductionCompany>,
    areaCompanyIdByAreaId: ReadonlyMap<string, string>,
    adjacencyByCompanyId: Map<string, Set<string>>
): void {
    // In goods mode, only land-adjacent zones of the same good conflict.
    for (const [areaId, companyId] of areaCompanyIdByAreaId.entries()) {
        if (!isIndonesiaNodeId(areaId)) {
            continue
        }

        const company = companyById.get(companyId)
        if (!company) {
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

            const neighborCompany = companyById.get(neighborCompanyId)
            if (!neighborCompany || neighborCompany.good !== company.good) {
                continue
            }

            addConflictEdge(adjacencyByCompanyId, companyId, neighborCompanyId)
        }
    }
}

export function productionConflictRankByCompanyId(
    gameState: HydratedIndonesiaGameState,
    options: ProductionHatchOptions = {}
): Map<string, number> {
    const mode: ProductionHatchMode = options.mode ?? 'player'
    const companyById = productionCompanyById(gameState)
    const areaCompanyIdByAreaId = productionAreaCompanyIdByAreaId(gameState, companyById)
    const companyOrderById = productionCompanyOrderById(gameState, companyById)

    const adjacencyByCompanyId = new Map<string, Set<string>>()
    for (const companyId of companyById.keys()) {
        adjacencyByCompanyId.set(companyId, new Set())
    }

    if (mode === 'goods') {
        applyGoodsModeConflicts(gameState, companyById, areaCompanyIdByAreaId, adjacencyByCompanyId)
    } else {
        applyPlayerModeConflicts(gameState, companyById, areaCompanyIdByAreaId, adjacencyByCompanyId)
    }

    const orderedCompanyIds = [...companyById.keys()].sort((leftCompanyId, rightCompanyId) => {
        const leftOrder = companyOrderById.get(leftCompanyId) ?? Number.MAX_SAFE_INTEGER
        const rightOrder = companyOrderById.get(rightCompanyId) ?? Number.MAX_SAFE_INTEGER
        if (leftOrder !== rightOrder) {
            return leftOrder - rightOrder
        }
        return leftCompanyId.localeCompare(rightCompanyId)
    })

    const conflictRankByCompanyId = new Map<string, number>()
    const visitedCompanyIds = new Set<string>()
    for (const startCompanyId of orderedCompanyIds) {
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

            const neighborCompanyIds = adjacencyByCompanyId.get(companyId)
            if (!neighborCompanyIds) {
                continue
            }
            for (const neighborCompanyId of neighborCompanyIds) {
                if (!visitedCompanyIds.has(neighborCompanyId)) {
                    stack.push(neighborCompanyId)
                }
            }
        }

        if (connectedCompanyIds.length <= 1) {
            continue
        }

        connectedCompanyIds.sort((leftCompanyId, rightCompanyId) => {
            const leftOrder = companyOrderById.get(leftCompanyId) ?? Number.MAX_SAFE_INTEGER
            const rightOrder = companyOrderById.get(rightCompanyId) ?? Number.MAX_SAFE_INTEGER
            if (leftOrder !== rightOrder) {
                return leftOrder - rightOrder
            }
            return leftCompanyId.localeCompare(rightCompanyId)
        })

        for (const [index, companyId] of connectedCompanyIds.entries()) {
            conflictRankByCompanyId.set(companyId, index)
        }
    }

    return conflictRankByCompanyId
}

export function productionHatchVariantByCompanyId(
    gameState: HydratedIndonesiaGameState,
    hatchPatternCount: number,
    options: ProductionHatchOptions = {}
): Map<string, number> {
    const hatchVariantByCompanyId = new Map<string, number>()
    if (hatchPatternCount <= 0) {
        return hatchVariantByCompanyId
    }

    for (const [companyId, conflictRank] of productionConflictRankByCompanyId(gameState, options)) {
        if (conflictRank <= 0) {
            continue
        }

        hatchVariantByCompanyId.set(companyId, (conflictRank - 1) % hatchPatternCount)
    }

    return hatchVariantByCompanyId
}
