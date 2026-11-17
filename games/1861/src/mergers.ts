import { MergerRounds } from '@tabletop/18xx'
import {
    MajorIds1861,
    MajorShareCount,
    ownershipLimitPercent1861,
    certificateLimit1861
} from './companies.js'
import { Map1861 } from './map.js'
import { OperatingRules1861, TrainRules1861 } from './operating.js'
import { StockRules1861 } from './stock.js'
import { Market1861, convertible, majorStartSpaceAtOrBelow } from './stockMarket.js'
import { TileSet1861 } from './tiles.js'
import { MergerRoundPhaseIds } from './trains.js'

/**
 * After each operating round in phases 3 to 7 each minor may convert from the seventh column or
 * merge with others it connects to, between two and ten, no more than six of one player's, into
 * a public company of at least R100 (§12, the designer's 2021 ruling).
 */
export const MergerRounds1861 = new MergerRounds({
    market: Market1861,
    map: Map1861,
    tileSet: TileSet1861,
    operatingRules: OperatingRules1861,
    trainRules: TrainRules1861,
    stockRules: StockRules1861,
    majorIds: MajorIds1861,
    phaseIds: MergerRoundPhaseIds,
    convertible,
    startSpace: majorStartSpaceAtOrBelow,
    minimumPrice: 100,
    currency: '₽',
    limits: { minimum: 2, maximum: 10, perPlayer: 6 },
    majorShareCount: MajorShareCount,
    directorShares: 2,
    certificateLimit: (state) => certificateLimit1861(state.players.length),
    ownershipLimitPercent: (state) => ownershipLimitPercent1861(state.players.length)
})
