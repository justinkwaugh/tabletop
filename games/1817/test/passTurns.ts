import { expect } from 'vitest'
import { trainsOwnedBy, type EighteenXXState } from '@tabletop/18xx'
import type { ExamplePlay } from '@tabletop/18xx/scenarios'
import { mergerRoundCompanyId } from '../src/mergerRound.js'

function actingCompanyId(state: EighteenXXState): string | undefined {
    return (
        state.trackStep?.companyId ??
        state.trainPurchaseStep?.companyId ??
        state.loanStep?.companyId ??
        state.phaseChange?.discardCompanyIds[0] ??
        mergerRoundCompanyId(state)
    )
}

const CompanyPasses = [
    'FinishTrack',
    'FinishTrains',
    'FinishOperatingTurn',
    'PassMerger',
    'PassConvertedShares',
    'FinishConversionLoans'
]

/** Lays no track, runs, buys and borrows nothing and declines every merger round choice. */
export function passUntil(play: ExamplePlay, until: (state: EighteenXXState) => boolean) {
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
