import { describe, expect, it } from 'vitest'
import {
    CompanyType,
    IndonesiaNeighborDirection,
    type HydratedIndonesiaGameState
} from '@tabletop/indonesia'
import {
    productionConflictRankByCompanyId,
    productionHatchVariantByCompanyId
} from './productionHatching.js'

type TestProductionCompany = {
    id: string
    owner: string
    good: string
}

type TestPlayer = {
    playerId: string
    ownedCompanies: string[]
}

function buildGameState(args: {
    players: TestPlayer[]
    companies: TestProductionCompany[]
    areaCompanyByAreaId: Record<string, string>
    landAdjacencyPairs: Array<[string, string]>
}): HydratedIndonesiaGameState {
    const areas = Object.fromEntries(
        Object.entries(args.areaCompanyByAreaId).map(([areaId, companyId]) => {
            return [areaId, { id: areaId, type: 'Cultivated', companyId }]
        })
    )

    const adjacencyByAreaId = new Map<string, Set<string>>()
    for (const [leftAreaId, rightAreaId] of args.landAdjacencyPairs) {
        const leftNeighbors = adjacencyByAreaId.get(leftAreaId) ?? new Set<string>()
        leftNeighbors.add(rightAreaId)
        adjacencyByAreaId.set(leftAreaId, leftNeighbors)

        const rightNeighbors = adjacencyByAreaId.get(rightAreaId) ?? new Set<string>()
        rightNeighbors.add(leftAreaId)
        adjacencyByAreaId.set(rightAreaId, rightNeighbors)
    }

    const graph = {
        nodeById(id: string): { id: string } | undefined {
            if (!(id in areas)) {
                return undefined
            }
            return { id }
        },
        neighborsOf(node: { id: string }, direction: IndonesiaNeighborDirection): Array<{ id: string }> {
            if (direction !== IndonesiaNeighborDirection.Land) {
                return []
            }
            return [...(adjacencyByAreaId.get(node.id) ?? new Set<string>())].map((id) => ({ id }))
        }
    }

    return {
        players: args.players.map((player) => ({
            playerId: player.playerId,
            ownedCompanies: [...player.ownedCompanies]
        })),
        companies: args.companies.map((company) => ({
            id: company.id,
            owner: company.owner,
            type: CompanyType.Production,
            good: company.good
        })),
        board: {
            areas,
            graph
        }
    } as unknown as HydratedIndonesiaGameState
}

describe('productionConflictRankByCompanyId', () => {
    it('hatches the non-primary same-owner company when zones become land-adjacent across goods', () => {
        const state = buildGameState({
            players: [{ playerId: 'p1', ownedCompanies: ['c-old', 'c-new'] }],
            companies: [
                { id: 'c-old', owner: 'p1', good: 'Rice' },
                { id: 'c-new', owner: 'p1', good: 'Spice' }
            ],
            areaCompanyByAreaId: {
                A01: 'c-old',
                A02: 'c-new'
            },
            landAdjacencyPairs: [['A01', 'A02']]
        })

        const conflictRanks = productionConflictRankByCompanyId(state)
        const hatchVariants = productionHatchVariantByCompanyId(state, 4)

        expect(conflictRanks.get('c-old')).toBe(0)
        expect(conflictRanks.get('c-new')).toBe(1)
        expect(hatchVariants.get('c-old')).toBeUndefined()
        expect(hatchVariants.get('c-new')).toBeTypeOf('number')
    })

    it('keeps hatch assignment stable for an existing company when another company is added', () => {
        const state = buildGameState({
            players: [{ playerId: 'p1', ownedCompanies: ['c-1', 'c-2'] }],
            companies: [
                { id: 'c-1', owner: 'p1', good: 'Rice' },
                { id: 'c-2', owner: 'p1', good: 'Spice' }
            ],
            areaCompanyByAreaId: {
                A01: 'c-1',
                A02: 'c-2'
            },
            landAdjacencyPairs: [['A01', 'A02']]
        })

        const expandedState = buildGameState({
            players: [{ playerId: 'p1', ownedCompanies: ['c-1', 'c-2', 'c-3'] }],
            companies: [
                { id: 'c-1', owner: 'p1', good: 'Rice' },
                { id: 'c-2', owner: 'p1', good: 'Spice' },
                { id: 'c-3', owner: 'p1', good: 'Rubber' }
            ],
            areaCompanyByAreaId: {
                A01: 'c-1',
                A02: 'c-2',
                A03: 'c-3'
            },
            landAdjacencyPairs: [
                ['A01', 'A02'],
                ['A02', 'A03']
            ]
        })

        const initialHatchVariants = productionHatchVariantByCompanyId(state, 4)
        const expandedHatchVariants = productionHatchVariantByCompanyId(expandedState, 4)

        expect(initialHatchVariants.get('c-1')).toBeUndefined()
        expect(initialHatchVariants.get('c-2')).toBeTypeOf('number')
        expect(expandedHatchVariants.get('c-2')).toBe(initialHatchVariants.get('c-2'))
        expect(expandedHatchVariants.get('c-3')).toBeTypeOf('number')
    })

    it('does not hatch different-good companies that are not same-good and not adjacent', () => {
        const state = buildGameState({
            players: [{ playerId: 'p1', ownedCompanies: ['c-1', 'c-2'] }],
            companies: [
                { id: 'c-1', owner: 'p1', good: 'Rice' },
                { id: 'c-2', owner: 'p1', good: 'Spice' }
            ],
            areaCompanyByAreaId: {
                A01: 'c-1',
                A03: 'c-2'
            },
            landAdjacencyPairs: []
        })

        const hatchVariants = productionHatchVariantByCompanyId(state, 4)

        expect(hatchVariants.get('c-1')).toBeUndefined()
        expect(hatchVariants.get('c-2')).toBeUndefined()
    })

    it('goods mode hatches adjacent same-good companies even across owners', () => {
        const state = buildGameState({
            players: [
                { playerId: 'p1', ownedCompanies: ['c-1'] },
                { playerId: 'p2', ownedCompanies: ['c-2'] }
            ],
            companies: [
                { id: 'c-1', owner: 'p1', good: 'Rice' },
                { id: 'c-2', owner: 'p2', good: 'Rice' }
            ],
            areaCompanyByAreaId: {
                A01: 'c-1',
                A02: 'c-2'
            },
            landAdjacencyPairs: [['A01', 'A02']]
        })

        const conflictRanks = productionConflictRankByCompanyId(state, { mode: 'goods' })
        const hatchVariants = productionHatchVariantByCompanyId(state, 4, { mode: 'goods' })

        expect(conflictRanks.get('c-1')).toBe(0)
        expect(conflictRanks.get('c-2')).toBe(1)
        expect(hatchVariants.get('c-1')).toBeUndefined()
        expect(hatchVariants.get('c-2')).toBeTypeOf('number')
    })

    it('goods mode does not hatch adjacent different-good companies', () => {
        const state = buildGameState({
            players: [
                { playerId: 'p1', ownedCompanies: ['c-1'] },
                { playerId: 'p2', ownedCompanies: ['c-2'] }
            ],
            companies: [
                { id: 'c-1', owner: 'p1', good: 'Rice' },
                { id: 'c-2', owner: 'p2', good: 'Spice' }
            ],
            areaCompanyByAreaId: {
                A01: 'c-1',
                A02: 'c-2'
            },
            landAdjacencyPairs: [['A01', 'A02']]
        })

        const hatchVariants = productionHatchVariantByCompanyId(state, 4, { mode: 'goods' })

        expect(hatchVariants.get('c-1')).toBeUndefined()
        expect(hatchVariants.get('c-2')).toBeUndefined()
    })

    it('goods mode does not hatch non-adjacent same-good companies', () => {
        const state = buildGameState({
            players: [
                { playerId: 'p1', ownedCompanies: ['c-1'] },
                { playerId: 'p2', ownedCompanies: ['c-2'] }
            ],
            companies: [
                { id: 'c-1', owner: 'p1', good: 'Rice' },
                { id: 'c-2', owner: 'p2', good: 'Rice' }
            ],
            areaCompanyByAreaId: {
                A01: 'c-1',
                A04: 'c-2'
            },
            landAdjacencyPairs: []
        })

        const hatchVariants = productionHatchVariantByCompanyId(state, 4, { mode: 'goods' })

        expect(hatchVariants.get('c-1')).toBeUndefined()
        expect(hatchVariants.get('c-2')).toBeUndefined()
    })
})
