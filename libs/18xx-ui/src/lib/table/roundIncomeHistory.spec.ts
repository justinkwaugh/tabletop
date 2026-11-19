import { describe, expect, it } from 'vitest'
import {
    netWorthChange,
    roundIncomeHistory,
    type RoundIncomeHistory
} from './roundIncomeHistory.js'
import {
    MergerRound,
    earnings,
    mergerRoundEnd,
    mergerRoundStart,
    openingEnd,
    interrupt,
    operatingRoundStart,
    operatingTurnEnd,
    resume,
    stockRoundEnd
} from './roundActions.fixture.js'

const title = { titleRounds: [MergerRound] }

function rows(history: RoundIncomeHistory[]) {
    return history.map((round) =>
        round.kind !== 'operating'
            ? { label: round.label, playerNetWorth: round.playerNetWorth }
            : {
                  label: round.label,
                  playerIncome: round.playerIncome,
                  playerNetWorth: round.playerNetWorth,
                  complete: round.complete,
                  partial: round.partial
              }
    )
}

describe('round income history', () => {
    it('lists each completed stock round between the operating rounds with no income', () => {
        const round = { number: 1, roundNumber: 1 }
        const history = roundIncomeHistory(
            [
                stockRoundEnd('sr1', { alex: 400, blake: 390 }),
                operatingRoundStart('or1', round, { alex: 420, blake: 390 }, { alex: 20 }),
                operatingTurnEnd('finish', round, { alex: 450, blake: 400 })
            ],
            title
        )
        expect(rows(history)).toEqual([
            { label: 'SR 1', playerNetWorth: { alex: 400, blake: 390 } },
            {
                label: 'OR 1.1',
                playerIncome: { alex: 20 },
                playerNetWorth: { alex: 450, blake: 400 },
                complete: true,
                partial: false
            }
        ])
    })

    it('takes an unrecorded stock round end from the next operating round’s start', () => {
        const history = roundIncomeHistory(
            [
                stockRoundEnd('sr1'),
                operatingRoundStart('or1', { number: 1, roundNumber: 1 }, { alex: 420, blake: 390 })
            ],
            title
        )
        expect(rows(history)[0]).toEqual({
            label: 'SR 1',
            playerNetWorth: { alex: 420, blake: 390 }
        })
    })

    it('keeps operating rounds held before the first stock round apart from those after it', () => {
        const round = { number: 1, roundNumber: 1 }
        const history = roundIncomeHistory(
            [
                operatingRoundStart('opening-or', round, { alex: 400, blake: 400 }, { alex: 10 }),
                operatingTurnEnd('opening-finish', round, { alex: 410, blake: 400 }),
                stockRoundEnd('sr1', { alex: 380, blake: 420 }),
                operatingRoundStart('or1', round, { alex: 380, blake: 420 }, { blake: 5 }),
                operatingTurnEnd('finish', round, { alex: 390, blake: 425 })
            ],
            title
        )
        expect(rows(history)).toEqual([
            {
                label: 'OR 1.1',
                playerIncome: { alex: 10 },
                playerNetWorth: { alex: 410, blake: 400 },
                complete: true,
                partial: false
            },
            { label: 'SR 1', playerNetWorth: { alex: 380, blake: 420 } },
            {
                label: 'OR 1.1',
                playerIncome: { blake: 5 },
                playerNetWorth: { alex: 390, blake: 425 },
                complete: true,
                partial: false
            }
        ])
    })

    it('splits an endless set’s round around the stock round that interrupts it, ending its first part', () => {
        const round = { number: 1, roundNumber: 5, endless: true as const }
        const history = roundIncomeHistory(
            [
                stockRoundEnd('sr1', { alex: 400, blake: 400 }),
                operatingRoundStart('or5', round, { alex: 410, blake: 400 }),
                earnings({ number: 1, roundNumber: 5 }, { alex: 30 }),
                interrupt,
                stockRoundEnd('sr2', { alex: 430, blake: 380 }),
                resume,
                operatingTurnEnd('finish', round, { alex: 460, blake: 390 })
            ],
            title
        )
        expect(rows(history)).toEqual([
            { label: 'SR 1', playerNetWorth: { alex: 400, blake: 400 } },
            {
                label: 'OR 5.1',
                playerIncome: { alex: 30 },
                playerNetWorth: { alex: 410, blake: 400 },
                complete: true,
                partial: false
            },
            { label: 'SR 2', playerNetWorth: { alex: 430, blake: 380 } },
            {
                label: 'OR 5.2',
                playerIncome: {},
                playerNetWorth: { alex: 460, blake: 390 },
                complete: true,
                partial: false
            }
        ])
    })

    it('lists the opening and the title’s own rounds once they end, with no income', () => {
        const round = { number: 1, roundNumber: 1 }
        const history = roundIncomeHistory(
            [
                openingEnd('auction', { alex: 380, blake: 420 }),
                stockRoundEnd('sr1', { alex: 400, blake: 390 }),
                operatingRoundStart('or1', round, { alex: 400, blake: 390 }),
                operatingTurnEnd('finish', round, { alex: 450, blake: 400 }),
                mergerRoundStart('mr-start'),
                mergerRoundEnd('mr-end', { alex: 470, blake: 390 })
            ],
            title
        )
        expect(history.map(({ kind, label }) => ({ kind, label }))).toEqual([
            { kind: 'opening', label: 'Auction' },
            { kind: 'stock', label: 'SR 1' },
            { kind: 'operating', label: 'OR 1.1' },
            { kind: 'title', label: 'MR 1.1' }
        ])
        expect(history[3].playerNetWorth).toEqual({ alex: 470, blake: 390 })
    })

    it('measures the change past a round that recorded no net worth', () => {
        const first = { number: 1, roundNumber: 1 }
        const second = { number: 1, roundNumber: 2 }
        const history = roundIncomeHistory(
            [
                operatingRoundStart('or1', first, { alex: 400, blake: 400 }),
                operatingTurnEnd('finish1', first, { alex: 450, blake: 400 }),
                mergerRoundStart('mr-start'),
                mergerRoundEnd('mr-end'),
                operatingRoundStart('or2', second, { alex: 470, blake: 380 })
            ],
            title
        )
        expect(
            rows(history).map(({ label, playerNetWorth }) => ({ label, playerNetWorth }))
        ).toEqual([
            { label: 'OR 1.1', playerNetWorth: { alex: 450, blake: 400 } },
            { label: 'MR 1.1', playerNetWorth: undefined },
            { label: 'OR 1.2', playerNetWorth: { alex: 470, blake: 380 } }
        ])
        expect(netWorthChange(history, 1, 'alex')).toBeUndefined()
        expect(netWorthChange(history, 2, 'alex')).toBe(20)
        expect(netWorthChange(history, 2, 'blake')).toBe(-20)
    })

    it('gives no row to a round of the title’s own that was never held', () => {
        const history = roundIncomeHistory(
            [
                stockRoundEnd('sr1', { alex: 400, blake: 390 }),
                mergerRoundEnd('mr-end', { alex: 400, blake: 390 })
            ],
            title
        )
        expect(history.map(({ label }) => label)).toEqual(['SR 1'])
    })
})
