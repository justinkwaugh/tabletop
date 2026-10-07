import { describe, expect, it } from 'vitest'
import { getCompany } from '@tabletop/18xx'
import { playExample } from '@tabletop/18xx/scenarios'
import {
    EighteenThirtyTwoPrivateRules,
    EighteenThirtyTwoStockRules,
    londonShareChoices
} from './index.js'
import { EighteenThirtyTwoScenarios, buyOpeningPrivates } from './scenarios/index.js'

function londonOwnersTurn() {
    const play = playExample(EighteenThirtyTwoScenarios, 'opening', 3)
    const buyers = buyOpeningPrivates(play)
    play.act('ParCompany', { companyId: 'CG', marketSpaceId: '0:6' }, buyers.P7)
    while (play.state.activePlayerIds[0] !== buyers.P4) play.act('FinishStockTurn')
    return { play, owner: buyers.P4 }
}

describe('London Investment Company', () => {
    it('takes a free CoG share in the first stock round as the turn’s purchase', () => {
        const { play, owner } = londonOwnersTurn()
        const [certificateId] = londonShareChoices(play.state, owner)
        expect(certificateId).toMatch(/^CG:share:/)
        play.act('TakeLondonShare', { certificateId })
        const certificate = play.state.certificates.find((item) => item.id === certificateId)
        expect(certificate).toMatchObject({ owner: { kind: 'player', playerId: owner } })
        expect(play.valid(owner)).not.toContain('BuyShares')
        expect(play.state.londonCompanyId).toBe('CG')
        expect(getCompany(play.state, 'P4').closed).toBeFalsy()
        expect(londonShareChoices(play.state, owner)).toEqual([])
        expect(
            EighteenThirtyTwoStockRules.privateSales?.priceRange(play.state, 'P4')
        ).toBeUndefined()
    })

    it('closes when that company first pays a dividend', () => {
        const { play } = londonOwnersTurn()
        const [certificateId] = londonShareChoices(play.state, play.state.activePlayerIds[0])
        play.act('TakeLondonShare', { certificateId })
        const paid = (dividendPerShare: number) => ({
            ...play.state,
            earningsDistribution: {
                companyId: 'CG',
                choice: 'pay' as const,
                revenue: dividendPerShare * 10,
                retained: 0,
                dividendPerShare,
                bonusPerShare: 0,
                bankAdjustment: 0,
                payments: []
            }
        })
        expect(EighteenThirtyTwoPrivateRules.operationEffects(paid(7), 'CG')).toEqual([
            { kind: 'close', privateCompanyId: 'P4' }
        ])
        expect(EighteenThirtyTwoPrivateRules.operationEffects(paid(0), 'CG')).toEqual([])
        expect(EighteenThirtyTwoPrivateRules.operationEffects(paid(7), 'ACL')).toEqual([])
    })
})
