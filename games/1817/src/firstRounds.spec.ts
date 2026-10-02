import { expect, it } from 'vitest'
import { TileEdges, TrackConstruction, cashOwnedBy, companyMarketSpace } from '@tabletop/18xx'
import { playExample } from '@tabletop/18xx/scenarios'
import { EighteenSeventeenMap, EighteenSeventeenTrackRules } from './index.js'
import { EighteenSeventeenScenarios } from './scenarios/index.js'

it('plays from the opening through a company auction into a first operating round', () => {
    const play = playExample(EighteenSeventeenScenarios, 'opening', 3)
    for (let pass = 0; pass < 3; pass++) play.act('PassSelectionAuction')
    expect(play.state.machineState).toBe('StockRound')
    const opener = play.state.activePlayerIds[0]
    play.act('AuctionCompany', {
        companyId: 'AS',
        amount: 100,
        home: { locationId: 'B5', nodeId: 'city' }
    })
    play.act('PassCompanyAuction', { companyId: 'AS' })
    play.act('PassCompanyAuction', { companyId: 'AS' })
    expect(play.state.activePlayerIds).not.toEqual([opener])
    while (play.state.machineState === 'StockRound') play.act('FinishStockTurn')

    expect(play.state.machineState).toBe('LayingTrack')
    expect(play.state.trackStep?.companyId).toBe('AS')
    const lay = (locationId: string) => {
        const choice = new TrackConstruction(play.state, EighteenSeventeenTrackRules).choices(
            locationId
        )[0]
        play.act('LayTile', {
            companyId: 'AS',
            locationId,
            definitionId: choice.definitionId,
            rotation: choice.rotation,
            nodeMapping: choice.nodeMapping,
            expectedCost: choice.cost
        })
        return choice.cost
    }
    expect(lay('B5')).toBe(0)
    const track = new TrackConstruction(play.state, EighteenSeventeenTrackRules)
    const second = TileEdges.flatMap((edge) => {
        const neighbor = EighteenSeventeenMap.neighbor('B5', edge)
        return neighbor ? track.choices(neighbor.id) : []
    })
    expect(second.length).toBeGreaterThan(0)
    expect(second.every((choice) => choice.allowanceCost === 20)).toBe(true)
    play.act('FinishTrack', { companyId: 'AS' })

    expect(play.state.machineState).toBe('BuyingTrains')
    expect(companyMarketSpace(play.state.stockMarket, 'AS').price).toBe(45)
    const train = play.state.trainInventory.trains.find((item) => item.status === 'depot')!
    play.act('BuyTrain', {
        companyId: 'AS',
        trainId: train.id,
        definitionId: '2',
        expectedPrice: 100
    })
    expect(cashOwnedBy(play.state, { kind: 'company', companyId: 'AS' })).toBe(0)
    expect(play.state.operatingSet?.roundNumber).toBe(2)
    expect(play.state.trackStep?.companyId).toBe('AS')
})
