import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { Autorouter } from '@tabletop/18xx-autorouter'
import {
    Random,
    botMove as mergerTitleMove,
    playOut as playMergerTitle,
    type MergerTitleBotRules
} from '../../../libs/18xx/test/mergerTitleBot.js'
import { MajorIds1867 } from '../src/companies.js'
import { MergerRounds1867 } from '../src/mergers.js'
import { CorporateFinanceRules1867, TrainRules1867, TransferRules1867 } from '../src/operating.js'
import { privateTerms1867 } from '../src/privates.js'
import { RouteRules1867 } from '../src/routes.js'
import { StationRules1867 } from '../src/stations.js'
import { CompanyRules1867, StockRules1867 } from '../src/stock.js'
import { TrackRules1867 } from '../src/track.js'
import type { Table } from './kit.js'

const autorouter = await Autorouter.create(
    new Uint8Array(
        await readFile(
            createRequire(import.meta.url).resolve('@tabletop/18xx-autorouter/solver.wasm')
        )
    ).buffer
)

const Rules1867: MergerTitleBotRules = {
    stockRules: StockRules1867,
    companyRules: CompanyRules1867,
    trackRules: TrackRules1867,
    stationRules: StationRules1867,
    corporateFinanceRules: CorporateFinanceRules1867,
    routeRules: RouteRules1867,
    trainRules: TrainRules1867,
    transferRules: TransferRules1867,
    mergerRounds: MergerRounds1867,
    majorIds: MajorIds1867,
    privateMinimumBid: (privateId) => privateTerms1867(privateId).minimumBid,
    solveRoutes: (state, rules, companyId) =>
        autorouter
            .solve(state, rules, companyId, { timeLimitMs: 150 })
            .result.routes.map(({ trainId, start, paths }) => ({ trainId, start, paths }))
}

export { Random }

/** The bot's next move at the table. */
export function botMove(game: Table, random: Random) {
    return mergerTitleMove(Rules1867, game, random)
}

/** Plays the table to its end, or to the action limit, returning the moves made. */
export function playOut(
    game: Table,
    seed: number,
    limit = 8000,
    afterMove: () => void = () => {}
): number {
    return playMergerTitle(Rules1867, game, seed, limit, afterMove)
}
