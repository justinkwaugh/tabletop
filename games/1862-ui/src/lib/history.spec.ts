import { readFileSync, readdirSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import type { GameAction } from '@tabletop/common'
import { describe1862Action } from './history.js'

// The title's own Actions, as stored, each read back by its guard.
const TitleActionTypes = new Set([
    'StartParliamentRound',
    'EndParliamentRound',
    'OpenCharterAuction',
    'DeclineCharter',
    'RaiseCharterBid',
    'PassCharterBid',
    'ObtainCharter',
    'BuyStations',
    'EnforceObligations',
    'SellForFine',
    'ForgiveFine',
    'PlaceHome',
    'PlaceSmallStation',
    'BuildToLondon',
    'BuyWarranties',
    'ExpireWarranties',
    'SellTreasuryShares',
    'Refinance',
    'RedeemShare',
    'GoBankrupt',
    'BankruptCompany',
    'ProposeMerger',
    'AnswerMerger',
    'TakeMergeTurn',
    'DecideOption',
    'CompleteShareMerge',
    'FormLner'
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

describe('1862 history', () => {
    it('describes every stored title Action in the scenarios', () => {
        const names = {
            companyName: (companyId: string) => companyId,
            place: (locationId: string) => locationId
        }
        const session = {
            getPlayerName: (playerId: string) => playerId,
            presentation: { money: (amount: number) => `£${amount}` },
            companyInitials: (companyId: string) => companyId
        }
        const titleActions = storedActions.filter((action) => TitleActionTypes.has(action.type))
        expect(new Set(titleActions.map((action) => action.type)).size).toBeGreaterThan(15)
        for (const action of titleActions)
            expect(
                describe1862Action(action, names, session),
                `${action.type} is described`
            ).toBeDefined()
    })
})
