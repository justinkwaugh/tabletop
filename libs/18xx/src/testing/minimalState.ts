import { Color } from '@tabletop/common'
import type { FormationState } from '../company/companyState.js'
import type { DistributionState } from '../earnings/earningsDistribution.js'
import type { PhaseChangeState } from '../phases/phaseChange.js'
import { createStockRound } from '../stock/stockRound.js'
import { createRectangularStockMarket, placeStockMarker } from '../stock/stockMarket.js'

export const TestCompanyId = 'R'

export function minimalRailwayState(): DistributionState {
    const stockMarket = createRectangularStockMarket([[100, 110, 120]], () => 'white')
    placeStockMarker(stockMarket, TestCompanyId, '0:0')
    return {
        companies: [{ id: TestCompanyId, name: 'Railway', kind: 'major', shareCount: 10 }],
        bank: { name: 'Bank' },
        cash: [{ owner: { kind: 'bank' }, amount: 'unlimited' }],
        certificates: [],
        certificatePools: [],
        stations: [],
        stationReservations: [],
        tileInventory: { tileSetId: 'tiles', placements: {}, retiredPieceIds: [] },
        trainInventory: { depotId: 'trains', trains: [], nextTrainNumber: 1 },
        phaseId: '3',
        stockMarket
    }
}

export const TestPlayerId = 'alex'

export function minimalPlayState(): DistributionState & PhaseChangeState & FormationState {
    return {
        ...minimalRailwayState(),
        players: [{ playerId: TestPlayerId, color: Color.Blue }],
        activePlayerIds: [TestPlayerId],
        turnManager: {
            series: [{ type: 'turn', playerId: TestPlayerId, start: 0 }],
            turnOrder: [TestPlayerId],
            turnCounts: { [TestPlayerId]: 0 }
        },
        stockRound: createStockRound(1),
        ownershipLimitExemptions: [],
        phaseEvents: [],
        tranches: []
    }
}
