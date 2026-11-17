import { MergerRounds } from '@tabletop/18xx'
import {
    MajorIds1867,
    MajorShareCount,
    certificateLimit1867,
    ownershipLimitPercent1867
} from './companies.js'
import { Map1867 } from './map.js'
import { OperatingRules1867, TrainRules1867 } from './operating.js'
import { StockRules1867 } from './stock.js'
import { Market1867, convertible, majorStartSpaceAtOrBelow } from './stockMarket.js'
import { TileSet1867 } from './tiles.js'
import { MergerRoundPhaseIds } from './trains.js'

/**
 * After each operating round in phases 3 to 7 each minor may convert from the blue zone or merge
 * with others it connects to, between two and ten, no more than six of one player's, into a major
 * of at least $100 (GTG §9, the designer's 2021 ruling on mergers worth less than $100).
 */
export const MergerRounds1867 = new MergerRounds({
    market: Market1867,
    map: Map1867,
    tileSet: TileSet1867,
    operatingRules: OperatingRules1867,
    trainRules: TrainRules1867,
    stockRules: StockRules1867,
    majorIds: MajorIds1867,
    phaseIds: MergerRoundPhaseIds,
    convertible,
    startSpace: majorStartSpaceAtOrBelow,
    minimumPrice: 100,
    currency: '$',
    limits: { minimum: 2, maximum: 10, perPlayer: 6 },
    majorShareCount: MajorShareCount,
    directorShares: 2,
    certificateLimit: (state) => certificateLimit1867(state.players.length),
    ownershipLimitPercent: (state) => ownershipLimitPercent1867(state.players.length)
})
