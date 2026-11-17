import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { Autorouter } from '@tabletop/18xx-autorouter'
import {
    Random,
    botMove as mergerTitleMove,
    playOut as playMergerTitle,
    type MergerTitleBotRules
} from '../../../libs/18xx/test/mergerTitleBot.js'
import { MajorIds1861 } from '../src/companies.js'
import { MergerRounds1861 } from '../src/mergers.js'
import { CorporateFinanceRules1861, TrainRules1861, TransferRules1861 } from '../src/operating.js'
import { privateTerms1861 } from '../src/privates.js'
import { RouteRules1861 } from '../src/routes.js'
import { StationRules1861 } from '../src/stations.js'
import { CompanyRules1861, StockRules1861 } from '../src/stock.js'
import { TrackRules1861 } from '../src/track.js'
import type { Table } from './kit.js'

const autorouter = await Autorouter.create(
    new Uint8Array(
        await readFile(
            createRequire(import.meta.url).resolve('@tabletop/18xx-autorouter/solver.wasm')
        )
    ).buffer
)

const Rules1861: MergerTitleBotRules = {
    stockRules: StockRules1861,
    companyRules: CompanyRules1861,
    trackRules: TrackRules1861,
    stationRules: StationRules1861,
    corporateFinanceRules: CorporateFinanceRules1861,
    routeRules: RouteRules1861,
    trainRules: TrainRules1861,
    transferRules: TransferRules1861,
    mergerRounds: MergerRounds1861,
    majorIds: MajorIds1861,
    privateMinimumBid: (privateId) => privateTerms1861(privateId).minimumBid,
    solveRoutes: (state, rules, companyId) =>
        autorouter
            .solve(state, rules, companyId, { timeLimitMs: 150 })
            .result.routes.map(({ trainId, start, paths }) => ({ trainId, start, paths }))
}

export { Random }

/** The bot's next move at the table. */
export function botMove(game: Table, random: Random) {
    return mergerTitleMove(Rules1861, game, random)
}

/** Plays the table to its end, or to the action limit, returning the moves made. */
export function playOut(
    game: Table,
    seed: number,
    limit = 8000,
    afterMove: () => void = () => {}
): number {
    return playMergerTitle(Rules1861, game, seed, limit, afterMove)
}
