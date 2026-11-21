import { readFileSync, readdirSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { ActionSource, type GameAction } from '@tabletop/common'
import { describe1860Action } from './history.js'

// The title's own Actions, as stored, each read back by its guard.
const TitleActionTypes = new Set([
    'BidForChoice',
    'PassForChoice',
    'ChooseCertificate',
    'EndInitialAuction',
    'LayHomeTile',
    'SkipHomeTile',
    'SellPrivateToBank',
    'BuyPrivateFromBank',
    'ChangeInsolvency',
    'BankruptCompany',
    'BeginSouthernStockRound',
    'FormBritishRail',
    'NationaliseCompanies',
    'BeginReturningTrains',
    'ReturnTrain'
])

const scenarioDirectory = new URL('../scenarios/', import.meta.url)
const storedActions = readdirSync(scenarioDirectory)
    .filter((file) => file.endsWith('.json'))
    .flatMap(
        (file): (Omit<GameAction, 'createdAt'> & { createdAt?: string })[] =>
            JSON.parse(readFileSync(new URL(file, scenarioDirectory), 'utf8')).actions
    )
    // Files hold JSON; the dates are read back as the harness reads them.
    .map((action): GameAction => ({
        ...action,
        createdAt: action.createdAt === undefined ? undefined : new Date(action.createdAt)
    }))

const names = {
    companyName: (companyId: string) => companyId,
    place: (locationId: string) => locationId
}
const context = {
    getPlayerName: (playerId: string) => playerId,
    presentation: { money: (amount: number) => `£${amount}` }
}

const action = (type: string, fields: object): GameAction => ({
    id: `${type}-1`,
    gameId: 'game',
    source: ActionSource.System,
    type,
    ...fields
})

describe('1860 history', () => {
    it('describes every stored title Action in the scenarios', () => {
        const titleActions = storedActions.filter((stored) => TitleActionTypes.has(stored.type))
        expect(new Set(titleActions.map((stored) => stored.type)).size).toBeGreaterThan(9)
        for (const stored of titleActions)
            expect(
                describe1860Action(stored, names, context),
                `${stored.type} is described`
            ).toBeDefined()
    })

    it('describes the endgame from its metadata', () => {
        expect(
            describe1860Action(
                action('NationaliseCompanies', { metadata: { closedCompanyIds: ['SC', 'VYSC'] } }),
                names,
                context
            )?.text
        ).toBe('British Rail closed SC and VYSC')
        expect(describe1860Action(action('FormBritishRail', {}), names, context)?.text).toMatch(
            /^British Rail formed/
        )
        expect(
            describe1860Action(action('BeginSouthernStockRound', {}), names, context)?.text
        ).toMatch(/^The Southern Railway/)
        expect(
            describe1860Action(action('BeginReturningTrains', { companyId: 'IOW' }), names, context)
                ?.text
        ).toBe('IOW is over its train limit')
    })

    it('names the private the bank sold and those its sale closed', () => {
        const row = describe1860Action(
            action('BuyPrivateFromBank', {
                source: ActionSource.User,
                playerId: 'p1',
                privateCompanyId: 'FFC',
                metadata: { price: 200, closedPrivateIds: ['BHC', 'CMH'] }
            }),
            names,
            context
        )
        expect(row).toMatchObject({
            text: 'bought FFC from the bank',
            value: '£200',
            detailLines: ['BHC and CMH closed']
        })
    })

    it('names a returned train from its metadata, though it may since have rusted away', () => {
        const row = describe1860Action(
            action('ReturnTrain', {
                source: ActionSource.User,
                playerId: 'p1',
                companyId: 'IOW',
                trainId: '1860/4+2/10',
                metadata: { definitionId: '4+2' }
            }),
            names,
            context
        )
        expect(row?.text).toBe('returned IOW’s 4+2 to the bank')
    })
})
