import { expect } from 'vitest'
import { trainsOwnedBy } from '@tabletop/18xx'
import type { EighteenSeventeenState } from '../src/state.js'
import type { ExamplePlay } from '@tabletop/18xx/scenarios'
import { acquisitionRoundCompanyId } from '../src/acquisitionRound.js'
import { mergerRoundCompanyId } from '../src/mergerRound.js'

function actingCompanyId(state: EighteenSeventeenState): string | undefined {
    return (
        state.trackStep?.companyId ??
        state.trainPurchaseStep?.companyId ??
        state.loanStep?.companyId ??
        state.phaseChange?.discardCompanyIds[0] ??
        mergerRoundCompanyId(state) ??
        acquisitionRoundCompanyId(state)
    )
}

const CompanyPasses = [
    'FinishTrack',
    'FinishTrains',
    'FinishOperatingTurn',
    'PassMerger',
    'PassConvertedShares',
    'FinishConversionLoans',
    'DeclineOffer',
    'PassOnCompany'
]

/** Lays no track, runs, buys and borrows nothing and declines every merger and sale. */
export function passUntil(
    play: ExamplePlay<EighteenSeventeenState>,
    until: (state: EighteenSeventeenState) => boolean
) {
    for (let step = 0; step < 100 && !until(play.state); step++) {
        const actions = play.valid(play.state.activePlayerIds[0])
        const companyId = actingCompanyId(play.state)
        const pass = CompanyPasses.find((type) => actions.includes(type))
        if (pass) play.act(pass, { companyId })
        else if (actions.includes('FinishStockTurn')) play.act('FinishStockTurn')
        else if (companyId && actions.includes('DiscardTrain'))
            play.act('DiscardTrain', {
                companyId,
                trainId: trainsOwnedBy(play.state, { kind: 'company', companyId })[0]?.id
            })
        else throw new Error(`No passing action in ${play.state.machineState}`)
    }
    expect(until(play.state)).toBe(true)
}
