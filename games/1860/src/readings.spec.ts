import { describe, expect, it } from 'vitest'
import { getCompany } from '@tabletop/18xx'
import { assertExists } from '@tabletop/common'
import { CompanyIds1860 } from './companies.js'
import { bankExhausted, playerMoney } from './ending.js'
import { everyDirectedCompanyHasTrain } from './endgame.js'
import { IpoPoolId } from './names.js'
import { receiverOf } from './operating.js'
import type { State1860 } from './state.js'
import { homeHexBare } from './stations.js'
import { floatCompany1860 } from './stock.js'
import { edit, kit } from '../test/kit.js'
import { openedWith, seated, setCash } from '../test/positions.js'

// The readings title-design.md records where the rules and rulings leave a choice.
describe('1860 readings', () => {
    it('starts a refloated company solvent, whatever it was before its bankruptcy (1, BK-7)', () => {
        const game = openedWith(seated(3))
        edit(game, (state) => {
            state.bankruptIds = ['IOW']
            state.insolventIds = ['IOW']
            floatCompany1860(state, 'IOW')
        })
        expect(game.state.bankruptIds).toEqual([])
        expect(game.state.insolventIds).toEqual([])
    })

    it('breaks the bank once the players hold its £10,000 (3, MI-2)', () => {
        const game = openedWith(seated(3))
        const share = (total: number) => (state: State1860) => {
            setCash(state, 'p1', total - 2000)
            setCash(state, 'p2', 1000)
            setCash(state, 'p3', 1000)
        }
        edit(game, share(9990))
        expect(playerMoney(game.state)).toBe(9990)
        expect(bankExhausted(game.state)).toBe(false)
        edit(game, share(10_000))
        expect(bankExhausted(game.state)).toBe(true)
    })

    it('blocks nationalisation on a directed company without a train, floated or not (4, OQ-5)', () => {
        const game = openedWith(seated(3))
        // The auction's directors hold 20% each: started, not floated.
        expect(getCompany(game.state, 'CN').floated).toBeFalsy()
        expect(everyDirectedCompanyHasTrain(game.state)).toBe(false)
        edit(game, (state) => {
            kit.giveTrain(state, 'CN', '2+1')
        })
        expect(everyDirectedCompanyHasTrain(game.state)).toBe(false)
        edit(game, (state) => {
            kit.giveTrain(state, 'IOW', '2+1')
        })
        expect(everyDirectedCompanyHasTrain(game.state)).toBe(true)
    })

    it('lays no home tile for a company floated after the Southern’s stock round (5, OQ-4)', () => {
        const game = openedWith(seated(3))
        const companyId = CompanyIds1860.find((id) => homeHexBare(game.state, id))
        assertExists(companyId, 'A company has a bare home hex')
        const floated = (southernStockRound: boolean) => {
            const state = structuredClone(game.state)
            if (southernStockRound) state.southernStockRound = true
            floatCompany1860(state, companyId)
            return state
        }
        expect(floated(false).homeTileCompanyId).toBe(companyId)
        const late = floated(true)
        expect(late.homeTileCompanyId).toBeUndefined()
        expect(
            late.stations.some(
                (station) => station.companyId === companyId && station.status === 'placed'
            )
        ).toBe(true)
    })

    it('makes the largest holder receiver, ties going from the priority holder (6, SR-12)', () => {
        const game = openedWith(seated(3))
        const receiver = (turnOrder: string[]) => {
            const state = structuredClone(game.state)
            state.turnManager.turnOrder = turnOrder
            let given = 0
            for (const certificate of state.certificates) {
                if (certificate.kind !== 'share' || certificate.companyId !== 'IOW') continue
                const holder = certificate.president ? undefined : ['p2', 'p2', 'p3', 'p3'][given++]
                certificate.owner = holder ? { kind: 'player', playerId: holder } : { kind: 'bank' }
                if (holder) delete certificate.poolId
                else certificate.poolId = IpoPoolId
            }
            return receiverOf(state, 'IOW')
        }
        expect(receiver(['p1', 'p2', 'p3'])).toBe('p2')
        expect(receiver(['p3', 'p1', 'p2'])).toBe('p3')
        expect(receiver(['p1', 'p3', 'p2'])).toBe('p3')
    })
})
