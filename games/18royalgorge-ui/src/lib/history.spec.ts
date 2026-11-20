import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { moneyFormat } from '@tabletop/18xx-ui'
import type { GameAction } from '@tabletop/common'
import { describeRoyalGorgeAction } from './history.js'

// Recorded games keep each Action's creation time as text; Actions carry it as a Date.
const recorded = (name: string): GameAction[] =>
    JSON.parse(
        readFileSync(new URL(`../scenarios/${name}.json`, import.meta.url), 'utf8'),
        (key, value) => (key === 'createdAt' ? new Date(value) : value)
    ).actions
const actions = recorded('finished-game')
const names = {
    companyName: (id: string) => id,
    playerName: (id: string) => id,
    place: (id: string) => id,
    bankName: 'Bank'
}
const describeFirst = (type: string, matching: (action: GameAction) => boolean = () => true) => {
    const action = actions.find((entry) => entry.type === type && matching(entry))
    if (!action) throw new Error(`The recorded games hold a ${type}`)
    return describeRoyalGorgeAction(action, names, moneyFormat('$'))
}

describe('18RoyalGorge history', () => {
    it('lists the metal companies’ payouts and the debt marker’s move as a set ends', () => {
        const row = describeFirst('SettleOperatingRound', (action) =>
            JSON.stringify(action).includes('"payouts"')
        )
        expect(row?.text).toBe('CF&I and VGC paid their shareholders')
        expect(row?.detailLines?.some((line) => line.startsWith('VGC paid $'))).toBe(true)
        expect(row?.detailLines?.at(-1)).toBe(
            'The gold track cleared and the steel market refilled'
        )
    })

    it('names a debt marker move between sets as a routine row', () => {
        const row = describeFirst(
            'SettleOperatingRound',
            (action) =>
                JSON.stringify(action).includes('debtSpaceId') &&
                !JSON.stringify(action).includes('"payouts"')
        )
        expect(row?.text).toMatch(/^Debt marker → \$\d+$/)
        expect(row?.routine).toBe(true)
    })

    it('describes each title action from its input and metadata', () => {
        expect(describeFirst('ShipGold')?.text).toMatch(/shipped gold from/)
        expect(describeFirst('PayDebt')?.text).toMatch(/paid (a|one of)/)
        expect(describeFirst('ChooseSteel')?.text).toMatch(/chose \w+ steel from/)
        expect(describeFirst('BuyMetalShares')?.text).toMatch(/with the G5|with the B6/)
        const ship = actions.find((action) => action.type === 'ShipGold')
        if (!ship) throw new Error('The recorded game ships gold')
        const extension = {
            id: ship.id,
            gameId: ship.gameId,
            source: ship.source,
            playerId: ship.playerId,
            createdAt: ship.createdAt,
            type: 'ExtendTrain',
            companyId: 'RG',
            trainId: '2+-1',
            sourceId: 'B5',
            stops: 1
        }
        const row = describeRoyalGorgeAction(extension, names, moneyFormat('$'))
        expect(row?.text).toBe('RG lengthened a train by 1 stop')
        expect(row?.detail).toBe('With the B5')
    })
})
