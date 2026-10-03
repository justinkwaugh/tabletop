import { describe, expect, it } from 'vitest'
import { ActionSource, assertExists } from '@tabletop/common'
import { placeStockMarker, type BuyTrain } from '@tabletop/18xx'
import { playExample } from '@tabletop/18xx/scenarios'
import { EighteenSeventeenScenarios } from '@tabletop/1817/scenarios'
import { historyDescription } from '../../../../libs/18xx-ui/src/lib/table/historyDescription.js'
import {
    EighteenSeventeenCompanyColumns,
    eighteenSeventeenCompanyFacts,
    eighteenSeventeenGameFacts
} from '../../../../games/1817-ui/src/lib/titleFacts.js'

describe('1817’s game facts', () => {
    it('show the seed money while the opening auction lasts', () => {
        const play = playExample(EighteenSeventeenScenarios, 'opening', 3)
        expect(eighteenSeventeenGameFacts(play.state)).toEqual([
            { label: 'Seed money', value: '$200' }
        ])
        expect(
            eighteenSeventeenGameFacts(playExample(EighteenSeventeenScenarios, 'trading', 3).state)
        ).toEqual([])
    })

    it('show when the game ends once the 8-train has set it', () => {
        const play = playExample(EighteenSeventeenScenarios, 'trading', 3, (state) => {
            state.gameEnding = {
                reason: 'First 8-train',
                finalOperatingSet: 7,
                finalOperatingRounds: 2
            }
        })
        expect(eighteenSeventeenGameFacts(play.state)).toEqual([
            { label: 'Game ends', value: 'after AR 7.2' }
        ])
    })
})

describe('1817’s company presentation', () => {
    it('lists each started company’s size and loans against its limit', () => {
        const play = playExample(EighteenSeventeenScenarios, 'trading', 3)
        const text = (id: string, companyId: string) =>
            EighteenSeventeenCompanyColumns.find((column) => column.id === id)?.text(
                play.state,
                companyId
            )
        expect([text('size', 'BA'), text('loans', 'BA')]).toEqual(['5', '0/5'])
        expect([text('size', 'AS'), text('loans', 'AS')]).toEqual(['—', '—'])
    })

    it('gives a company’s interest and closing zone in its details', () => {
        const play = playExample(EighteenSeventeenScenarios, 'construction', 3, (state) => {
            state.interestRate = 10
            const company = state.companies.find((item) => item.id === 'PLE')
            assertExists(company, 'PLE is in the game')
            company.loans = 2
            placeStockMarker(state.stockMarket, 'PLE', '0:2')
        })
        expect(eighteenSeventeenCompanyFacts(play.state, 'PLE')).toEqual([
            { label: 'Size', value: '2' },
            { label: 'Interest', value: '$20' },
            { label: 'Zone', value: 'Acquisition' }
        ])
    })
})

it('names who the bank paid as a train departed', () => {
    const play = playExample(EighteenSeventeenScenarios, 'construction', 3)
    const action: BuyTrain = {
        id: 'buy',
        gameId: 'game',
        source: ActionSource.User,
        playerId: 'blair',
        type: 'BuyTrain',
        companyId: 'BA',
        trainId: 't',
        definitionId: '3',
        expectedPrice: 250,
        metadata: {
            companyId: 'BA',
            trainId: 't',
            definitionId: '3',
            price: 250,
            departurePayments: [
                { from: { kind: 'bank' }, to: { kind: 'company', companyId: 'PLE' }, amount: 30 }
            ]
        }
    }
    expect(historyDescription(action, play.state).detail).toBe('PLE received $30')
})
