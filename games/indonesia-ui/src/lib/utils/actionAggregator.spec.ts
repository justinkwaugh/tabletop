import { describe, expect, it } from 'vitest'
import { ActionSource, type GameAction } from '@tabletop/common'
import { ActionType, CompanyType, PassReason } from '@tabletop/indonesia'
import { aggregateActions, isAggregatedIndonesiaAction } from './actionAggregator.js'

function expandAction(
    id: string,
    playerId: string,
    areaId: string,
    index?: number,
    cost?: number
): GameAction {
    return {
        id,
        gameId: 'g1',
        source: ActionSource.User,
        type: ActionType.Expand,
        playerId,
        index,
        areaId,
        ...(cost === undefined ? {} : { metadata: { cost } })
    } as unknown as GameAction
}

function passAction(id: string, playerId: string, reason?: PassReason): GameAction {
    return {
        id,
        gameId: 'g1',
        source: ActionSource.User,
        type: ActionType.Pass,
        playerId,
        ...(reason ? { reason } : {})
    } as unknown as GameAction
}

function removeSiapSajiAreaAction(id: string, playerId: string, areaId: string): GameAction {
    return {
        id,
        gameId: 'g1',
        source: ActionSource.User,
        type: ActionType.RemoveSiapSajiArea,
        playerId,
        areaId
    } as unknown as GameAction
}

function proposeMergerAction(
    id: string,
    playerId: string,
    companyAId: string,
    companyBId: string,
    index?: number
): GameAction {
    return {
        id,
        gameId: 'g1',
        source: ActionSource.User,
        type: ActionType.ProposeMerger,
        playerId,
        companyAId,
        companyBId,
        index
    } as unknown as GameAction
}

function placeMergerBidAction(id: string, playerId: string, amount: number, index?: number): GameAction {
    return {
        id,
        gameId: 'g1',
        source: ActionSource.User,
        type: ActionType.PlaceMergerBid,
        playerId,
        amount,
        index
    } as unknown as GameAction
}

function passMergerBidAction(id: string, playerId: string, index?: number): GameAction {
    return {
        id,
        gameId: 'g1',
        source: ActionSource.User,
        type: ActionType.PassMergerBid,
        playerId,
        index
    } as unknown as GameAction
}

function deliverGoodAction(
    id: string,
    playerId: string,
    shippingOwnerPlayerId: string,
    seaAreaIds: string[],
    index?: number
): GameAction {
    return {
        id,
        gameId: 'g1',
        source: ActionSource.User,
        type: ActionType.DeliverGood,
        playerId,
        cultivatedAreaId: 'A01',
        shippingCompanyId: 'ship-co',
        seaAreaIds,
        cityId: 'city-1',
        index,
        metadata: {
            good: 'Rice',
            revenue: 20,
            shippingCost: seaAreaIds.length * 5,
            netProfit: 20 - seaAreaIds.length * 5,
            shippingPayments: [
                {
                    shippingCompanyId: 'ship-co',
                    ownerPlayerId: shippingOwnerPlayerId,
                    amount: seaAreaIds.length * 5
                }
            ]
        }
    } as unknown as GameAction
}

function chooseOperatingCompanyAction(
    id: string,
    playerId: string,
    good: 'Rice' | 'Spice' | 'Rubber' | 'Oil' | 'SiapSaji',
    index?: number
): GameAction {
    return {
        id,
        gameId: 'g1',
        source: ActionSource.User,
        type: ActionType.ChooseOperatingCompany,
        playerId,
        companyId: 'prod-1',
        index,
        metadata: {
            companyType: CompanyType.Production,
            good
        }
    } as unknown as GameAction
}

function chooseShippingCompanyAction(id: string, playerId: string, index?: number): GameAction {
    return {
        id,
        gameId: 'g1',
        source: ActionSource.User,
        type: ActionType.ChooseOperatingCompany,
        playerId,
        companyId: 'ship-1',
        index,
        metadata: {
            companyType: CompanyType.Shipping
        }
    } as unknown as GameAction
}

describe('aggregateActions', () => {
    it('aggregates consecutive expand actions by the same player', () => {
        const actions = [
            expandAction('a1', 'p1', 'A01', 10),
            expandAction('a2', 'p1', 'A02', 11),
            expandAction('a3', 'p1', 'A03', 12)
        ]

        const aggregated = Array.from(aggregateActions(actions))

        expect(aggregated).toHaveLength(1)
        expect(isAggregatedIndonesiaAction(aggregated[0])).toBe(true)
        expect(aggregated[0]).toMatchObject({
            playerId: 'p1',
            aggregatedType: ActionType.Expand,
            count: 3,
            index: 12
        })
    })

    it('starts a new aggregate when player changes', () => {
        const actions = [
            expandAction('a1', 'p1', 'A01'),
            expandAction('a2', 'p2', 'A02')
        ]

        const aggregated = Array.from(aggregateActions(actions))

        expect(aggregated).toHaveLength(2)
        expect(aggregated.every((action) => isAggregatedIndonesiaAction(action))).toBe(true)
        expect(aggregated[0]).toMatchObject({ playerId: 'p1', count: 1 })
        expect(aggregated[1]).toMatchObject({ playerId: 'p2', count: 1 })
    })

    it('flushes expand aggregate when a non-expand action is encountered', () => {
        const actions = [
            expandAction('a1', 'p1', 'A01'),
            expandAction('a2', 'p1', 'A02'),
            passAction('a3', 'p1'),
            expandAction('a4', 'p1', 'A03')
        ]

        const aggregated = Array.from(aggregateActions(actions))

        expect(aggregated).toHaveLength(3)
        expect(aggregated[0]).toMatchObject({ type: 'AggregatedIndonesiaAction', count: 2 })
        expect(aggregated[1]?.type).toBe(ActionType.Pass)
        expect(aggregated[2]).toMatchObject({ type: 'AggregatedIndonesiaAction', count: 1 })
    })

    it('aggregates consecutive siap saji removals by the same player', () => {
        const actions = [
            removeSiapSajiAreaAction('a1', 'p1', 'A01'),
            removeSiapSajiAreaAction('a2', 'p1', 'A02'),
            removeSiapSajiAreaAction('a3', 'p1', 'A03')
        ]

        const aggregated = Array.from(aggregateActions(actions))

        expect(aggregated).toHaveLength(1)
        expect(isAggregatedIndonesiaAction(aggregated[0])).toBe(true)
        expect(aggregated[0]).toMatchObject({
            playerId: 'p1',
            aggregatedType: ActionType.RemoveSiapSajiArea,
            count: 3
        })
    })

    it('does not mix expand and siap saji removal aggregates', () => {
        const actions = [
            expandAction('a1', 'p1', 'A01'),
            removeSiapSajiAreaAction('a2', 'p1', 'A02')
        ]

        const aggregated = Array.from(aggregateActions(actions))

        expect(aggregated).toHaveLength(2)
        expect(aggregated[0]).toMatchObject({
            type: 'AggregatedIndonesiaAction',
            aggregatedType: ActionType.Expand,
            count: 1
        })
        expect(aggregated[1]).toMatchObject({
            type: 'AggregatedIndonesiaAction',
            aggregatedType: ActionType.RemoveSiapSajiArea,
            count: 1
        })
    })

    it('keeps only the latest merger bidding action for each player in an auction', () => {
        const actions = [
            proposeMergerAction('a1', 'p1', 'C1', 'C2', 1),
            placeMergerBidAction('a2', 'p1', 100, 2),
            placeMergerBidAction('a3', 'p2', 110, 3),
            placeMergerBidAction('a4', 'p1', 120, 4),
            passMergerBidAction('a5', 'p2', 5)
        ]

        const aggregated = Array.from(aggregateActions(actions))

        expect(aggregated).toHaveLength(3)
        expect(aggregated[0]?.type).toBe(ActionType.ProposeMerger)
        expect(aggregated[1]).toMatchObject({
            type: ActionType.PlaceMergerBid,
            playerId: 'p1',
            amount: 120,
            index: 4
        })
        expect(aggregated[2]).toMatchObject({
            type: 'AggregatedIndonesiaAction',
            aggregatedType: ActionType.PassMergerBid,
            playerId: 'p2',
            playerIds: ['p2'],
            count: 1,
            index: 5
        })
    })

    it('aggregates consecutive merger passes across players', () => {
        const actions = [
            proposeMergerAction('a1', 'p1', 'C1', 'C2', 1),
            placeMergerBidAction('a2', 'p1', 100, 2),
            passMergerBidAction('a3', 'p2', 3),
            passMergerBidAction('a4', 'p3', 4),
            passMergerBidAction('a5', 'p4', 5)
        ]

        const aggregated = Array.from(aggregateActions(actions))

        expect(aggregated).toHaveLength(3)
        expect(aggregated[0]?.type).toBe(ActionType.ProposeMerger)
        expect(aggregated[1]).toMatchObject({
            type: ActionType.PlaceMergerBid,
            playerId: 'p1',
            amount: 100,
            index: 2
        })
        expect(aggregated[2]).toMatchObject({
            type: 'AggregatedIndonesiaAction',
            aggregatedType: ActionType.PassMergerBid,
            playerId: 'p2',
            playerIds: ['p2', 'p3', 'p4'],
            count: 3,
            index: 5
        })
    })

    it('aggregates consecutive merger-announcement declines across players', () => {
        const actions = [
            passAction('a1', 'p1', PassReason.DeclineMergerAnnouncement),
            passAction('a2', 'p2', PassReason.DeclineMergerAnnouncement),
            passAction('a3', 'p3', PassReason.DeclineMergerAnnouncement)
        ]

        const aggregated = Array.from(aggregateActions(actions))

        expect(aggregated).toHaveLength(1)
        expect(aggregated[0]).toMatchObject({
            type: 'AggregatedIndonesiaAction',
            aggregatedType: ActionType.Pass,
            playerId: 'p1',
            playerIds: ['p1', 'p2', 'p3'],
            count: 3
        })
    })

    it('aggregates consecutive turn order bids in sequence', () => {
        const actions = [
            {
                id: 'a1',
                gameId: 'g1',
                source: ActionSource.User,
                type: ActionType.PlaceTurnOrderBid,
                playerId: 'p1',
                amount: 4,
                index: 1
            } as unknown as GameAction,
            {
                id: 'a2',
                gameId: 'g1',
                source: ActionSource.User,
                type: ActionType.PlaceTurnOrderBid,
                playerId: 'p2',
                amount: 6,
                index: 2
            } as unknown as GameAction,
            {
                id: 'a3',
                gameId: 'g1',
                source: ActionSource.User,
                type: ActionType.PlaceTurnOrderBid,
                playerId: 'p3',
                amount: 8,
                index: 3
            } as unknown as GameAction
        ]

        const aggregated = Array.from(aggregateActions(actions))

        expect(aggregated).toHaveLength(1)
        expect(aggregated[0]).toMatchObject({
            type: 'AggregatedIndonesiaAction',
            aggregatedType: ActionType.PlaceTurnOrderBid,
            playerId: 'p1',
            playerIds: ['p1', 'p2', 'p3'],
            count: 3,
            index: 3
        })
    })

    it('aggregates a production operation choice with its deliveries', () => {
        const actions = [
            chooseOperatingCompanyAction('a0', 'p1', 'Rice', 0),
            deliverGoodAction('a1', 'p1', 'ship-owner-a', ['S01', 'S02'], 1),
            deliverGoodAction('a2', 'p1', 'ship-owner-b', ['S03'], 2),
            deliverGoodAction('a3', 'p1', 'ship-owner-a', ['S04', 'S05', 'S06'], 3)
        ]

        const aggregated = Array.from(aggregateActions(actions))

        expect(aggregated).toHaveLength(1)
        expect(isAggregatedIndonesiaAction(aggregated[0])).toBe(true)
        expect(aggregated[0]).toMatchObject({
            playerId: 'p1',
            aggregatedType: ActionType.ChooseOperatingCompany,
            count: 3
        })
    })

    it('aggregates production deliveries together with following expansion', () => {
        const actions = [
            chooseOperatingCompanyAction('a0', 'p1', 'Rice', 0),
            deliverGoodAction('a1', 'p1', 'ship-owner-a', ['S01', 'S02'], 1),
            deliverGoodAction('a2', 'p1', 'ship-owner-b', ['S03'], 2),
            expandAction('a3', 'p1', 'A02', 3, 0),
            expandAction('a4', 'p1', 'A03', 4, 0)
        ]

        const aggregated = Array.from(aggregateActions(actions))

        expect(aggregated).toHaveLength(1)
        expect(isAggregatedIndonesiaAction(aggregated[0])).toBe(true)
        expect(aggregated[0]).toMatchObject({
            playerId: 'p1',
            aggregatedType: ActionType.ChooseOperatingCompany,
            count: 2,
            index: 4
        })
    })

    it('aggregates a lone production operation choice with zero sold goods', () => {
        const actions = [chooseOperatingCompanyAction('a0', 'p1', 'Rice', 0)]

        const aggregated = Array.from(aggregateActions(actions))

        expect(aggregated).toHaveLength(1)
        expect(isAggregatedIndonesiaAction(aggregated[0])).toBe(true)
        expect(aggregated[0]).toMatchObject({
            playerId: 'p1',
            aggregatedType: ActionType.ChooseOperatingCompany,
            count: 0
        })
    })

    it('aggregates a shipping operation choice with its expansions', () => {
        const actions = [
            chooseShippingCompanyAction('a0', 'p1', 0),
            expandAction('a1', 'p1', 'S01', 1, 0),
            expandAction('a2', 'p1', 'S02', 2, 0)
        ]

        const aggregated = Array.from(aggregateActions(actions))

        expect(aggregated).toHaveLength(1)
        expect(isAggregatedIndonesiaAction(aggregated[0])).toBe(true)
        expect(aggregated[0]).toMatchObject({
            playerId: 'p1',
            aggregatedType: ActionType.ChooseOperatingCompany,
            count: 2,
            index: 2
        })
    })

    it('aggregates a shipping operation choice with a skip-expansion pass', () => {
        const actions = [
            chooseShippingCompanyAction('a0', 'p1', 0),
            passAction('a1', 'p1', PassReason.SkipShippingExpansion)
        ]

        const aggregated = Array.from(aggregateActions(actions))

        expect(aggregated).toHaveLength(1)
        expect(isAggregatedIndonesiaAction(aggregated[0])).toBe(true)
        expect(aggregated[0]).toMatchObject({
            playerId: 'p1',
            aggregatedType: ActionType.ChooseOperatingCompany,
            count: 0
        })
    })
})
