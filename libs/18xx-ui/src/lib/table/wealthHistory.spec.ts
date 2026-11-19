import { expect, it } from 'vitest'
import { Color } from '@tabletop/common'
import { wealthHistory } from './wealthHistory.js'
import {
    MergerRound,
    interrupt,
    mergerRoundEnd,
    mergerRoundStart,
    operatingRoundStart,
    operatingTurnEnd,
    resume,
    stockRoundEnd
} from './roundActions.fixture.js'

const players = [
    { playerId: 'alex', color: Color.Red },
    { playerId: 'blake', color: Color.Green }
]

it('numbers the stock rounds that interrupt an endless set’s round, which ends in its later part', () => {
    const round = { number: 1, roundNumber: 5, endless: true as const }
    const points = wealthHistory(
        [
            stockRoundEnd('sr1', { alex: 400, blake: 400 }),
            operatingRoundStart('or5', round, { alex: 410, blake: 400 }),
            interrupt,
            stockRoundEnd('sr2', { alex: 430, blake: 380 }),
            resume,
            operatingTurnEnd('finish', round, { alex: 460, blake: 390 })
        ],
        { players, finalWealth: undefined },
        { startingCash: 400 }
    )
    expect(points.map(({ label, wealth }) => ({ label, wealth }))).toEqual([
        { label: 'Start', wealth: { alex: 400, blake: 400 } },
        { label: 'SR 1', wealth: { alex: 400, blake: 400 } },
        { label: 'SR 2', wealth: { alex: 430, blake: 380 } },
        { label: 'OR 5.2', wealth: { alex: 460, blake: 390 } }
    ])
})

it('marks the end of each round of the title’s own that recorded its net worth', () => {
    const first = { number: 1, roundNumber: 1 }
    const second = { number: 1, roundNumber: 2 }
    const points = wealthHistory(
        [
            stockRoundEnd('sr1', { alex: 400, blake: 400 }),
            operatingRoundStart('or1', first, { alex: 400, blake: 400 }),
            operatingTurnEnd('finish1', first, { alex: 420, blake: 400 }),
            mergerRoundStart('mr1-start'),
            mergerRoundEnd('mr1-end', { alex: 440, blake: 390 }),
            operatingRoundStart('or2', second, { alex: 440, blake: 390 }),
            operatingTurnEnd('finish2', second, { alex: 450, blake: 395 }),
            mergerRoundStart('mr2-start'),
            mergerRoundEnd('mr2-end')
        ],
        { players, finalWealth: undefined },
        { startingCash: 400, titleRounds: [MergerRound] }
    )
    expect(points.map(({ label }) => label)).toEqual([
        'Start',
        'SR 1',
        'OR 1.1',
        'MR 1.1',
        'OR 1.2'
    ])
})
