import { expect } from 'vitest'
import { trainsOverLimit } from '@tabletop/18xx'
import type { EighteenUSAState } from '../src/state.js'
import { EighteenUSAAcquisitionRounds, EighteenUSAConversionRounds } from '../src/companyRounds.js'
import { EighteenUSATrainRules } from '../src/trainRules.js'
import type { Table } from './kit.js'

function actingCompanyId(state: EighteenUSAState): string | undefined {
    return (
        state.trackStep?.companyId ??
        state.stationStep?.companyId ??
        state.routeStep?.companyId ??
        state.trainPurchaseStep?.companyId ??
        state.loanStep?.companyId ??
        state.phaseChange?.discardCompanyIds[0] ??
        EighteenUSAConversionRounds.companyId(state) ??
        EighteenUSAAcquisitionRounds.companyId(state)
    )
}

const CompanyPasses = [
    'FinishTrack',
    'FinishStations',
    'FinishTrains',
    'FinishOperatingTurn',
    'PassMerger',
    'PassConvertedShares',
    'FinishConversionLoans',
    'DeclineOffer',
    'SkipCompanySale',
    'PassOnCompany',
    'FinishAcquisitionLoans'
]

/** Lays no track, runs nothing, buys and borrows nothing and declines every merger and sale. */
export function passUntil(game: Table, until: (state: EighteenUSAState) => boolean): void {
    for (let step = 0; step < 400 && !until(game.state); step++) {
        const actions = game.valid(game.player)
        const companyId = actingCompanyId(game.state)
        const pass = CompanyPasses.find((type) => actions.includes(type))
        if (actions.includes('RunTrains')) game.act('RunTrains', { companyId, routes: [] })
        else if (actions.includes('DistributeEarnings'))
            game.act('DistributeEarnings', { companyId, choice: 'withhold' })
        else if (pass) game.act(pass, { companyId })
        else if (actions.includes('PassCompanyAuction'))
            game.act('PassCompanyAuction', { companyId: game.state.companyAuction?.companyId })
        else if (actions.includes('FinishStockTurn')) game.act('FinishStockTurn')
        else if (actions.includes('SaveTrain'))
            game.act('SaveTrain', { companyId: game.state.boneyard?.companyId })
        else if (companyId && actions.includes('DiscardTrain'))
            game.act('DiscardTrain', {
                companyId,
                trainId: trainsOverLimit(game.hydrated, EighteenUSATrainRules, companyId)[0]?.id
            })
        else throw new Error(`No passing action in ${game.state.machineState}: ${actions.join()}`)
    }
    expect(until(game.state)).toBe(true)
}
