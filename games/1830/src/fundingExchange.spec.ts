import { expect, it } from 'vitest'
import { ActionSource, assertExists } from '@tabletop/common'
import {
    EmergencyTrainFunding,
    getCompany,
    privateExchangeOffers,
    unownedTrain,
    type EighteenXXState
} from '@tabletop/18xx'
import { playExample } from '@tabletop/18xx/scenarios'
import { EighteenThirtyScenarios } from './scenarios/index.js'
import { EighteenThirtyPrivateRules } from './privateRules.js'
import { EighteenThirtyStockRules } from './stockRules.js'
import { EighteenThirtyTrainFundingRules } from './trainFundingRules.js'
import { EighteenThirtyTrainRules } from './trains.js'

const funding = (state: EighteenXXState) =>
    new EmergencyTrainFunding(
        state,
        EighteenThirtyTrainFundingRules,
        EighteenThirtyStockRules,
        EighteenThirtyTrainRules
    )
const exchanges = (state: EighteenXXState, playerId: string) =>
    privateExchangeOffers(state, playerId, EighteenThirtyPrivateRules, EighteenThirtyStockRules)

function position(ownerId = 'blair', prepare: (state: EighteenXXState) => void = () => {}) {
    const opening = playExample(EighteenThirtyScenarios, 'opening', 4).state
    return playExample(EighteenThirtyScenarios, 'funding', 4, (state) => {
        const company = opening.companies.find((company) => company.id === 'MH')
        const certificate = opening.certificates
            .filter((certificate) => !certificate.retired)
            .find((certificate) => certificate.companyId === 'MH')
        assertExists(company, 'M&H exists')
        assertExists(certificate, 'M&H has a certificate')
        certificate.owner = { kind: 'player', playerId: ownerId }
        delete certificate.poolId
        state.companies.push(company)
        state.certificates.push(certificate)
        prepare(state)
    })
}

function begin(play: ReturnType<typeof position>) {
    const purchase = funding(play.state).purchases()[0]
    assertExists(purchase, 'A compulsory purchase is available')
    play.act('FundTrain', {
        companyId: purchase.companyId,
        trainId: purchase.trainId,
        definitionId: purchase.definitionId,
        expectedPrice: purchase.price
    })
}

function exchange(play: ReturnType<typeof position>, playerId: string) {
    const state = play.state
    const offer = exchanges(state, playerId)[0]
    assertExists(offer, 'M&H may be exchanged')
    const outOfTurn = !state.activePlayerIds.includes(playerId)
    const type = outOfTurn ? 'ExchangePrivateOutOfTurn' : 'ExchangePrivate'
    expect(play.valid(playerId)).toContain(type)
    const { game, engine } = play
    const result = engine.executeCanonicalAction({
        game,
        state,
        action: {
            id: 'exchange-mh',
            gameId: game.id,
            source: ActionSource.User,
            type,
            ...offer,
            ...(outOfTurn ? { outOfTurn: true, sequenced: true } : {})
        }
    })
    let replay = state
    for (const processed of result.processedActions)
        replay = engine.applyProcessedAction({ game, state: replay, action: processed })
    expect(replay).toEqual(result.updatedState)
    for (const processed of [...result.processedActions].reverse())
        replay = engine.undoProcessedAction({ state: replay, action: processed })
    expect(replay).toEqual(state)
    play.replaceState(result.updatedState)
    return offer
}

it.each(['blair', 'casey'])(
    'allows %s to exchange M&H during compulsory funding without releasing the obligation',
    (playerId) => {
        const play = position(playerId)
        begin(play)
        const obligation = structuredClone(play.state.trainFunding)
        const offer = exchange(play, playerId)
        expect(getCompany(play.state, 'MH').closed).toBe(true)
        expect(
            play.state.certificates
                .filter((certificate) => !certificate.retired)
                .find((certificate) => certificate.id === offer.certificateId)?.owner
        ).toEqual({ kind: 'player', playerId })
        expect(play.state.trainFunding).toEqual(obligation)
        expect(play.state.machineState).toBe('FundingTrain')
        expect(play.state.activePlayerIds).toEqual(['blair'])
        expect(() => play.act('FinishTrains', { companyId: 'PRR' })).toThrow()
        expect(() => play.act('DeclareBankruptcy')).toThrow()
        if (playerId === 'blair') {
            const next = funding(play.state).next()
            expect(next.kind).toBe('sell')
            if (next.kind !== 'sell') throw Error('Blair must sell shares')
            const sale = next.sales.find(
                (sale) => sale.sales[0].companyId === 'NYC' && sale.sales[0].shares === 2
            )
            assertExists(
                sale,
                'The newly acquired NYC share is saleable along with the existing share'
            )
            play.act('SellFundingShares', {
                seller: sale.seller,
                companyId: 'NYC',
                shares: 2,
                expectedProceeds: sale.proceeds
            })
            expect(play.state.trainFunding?.sales).toContainEqual({
                seller: { kind: 'player', playerId },
                companyId: 'NYC',
                shares: 2
            })
        }
    }
)

function otherwiseBankrupt() {
    return position('blair', (state) => {
        const purchase = funding(state).purchases()[0]
        assertExists(purchase, 'A compulsory train is available')
        for (const cash of state.cash) {
            if (cash.owner.kind === 'company' && cash.owner.companyId === 'PRR')
                cash.amount = purchase.price - 10
            if (cash.owner.kind === 'player' && cash.owner.playerId === 'blair') cash.amount = 0
        }
        for (const certificate of state.certificates)
            if (
                !certificate.retired &&
                certificate.kind === 'share' &&
                !certificate.president &&
                certificate.owner.kind === 'player' &&
                certificate.owner.playerId === 'blair'
            )
                certificate.owner = { kind: 'player', playerId: 'casey' }
    })
}

it('offers the optional exchange before bankruptcy and lets its proceeds fund the train', () => {
    const play = otherwiseBankrupt()
    begin(play)
    expect(play.state.machineState).toBe('FundingTrain')
    expect(play.valid('blair')).toEqual(['DeclareBankruptcy', 'ExchangePrivate'])
    exchange(play, 'blair')
    const sale = funding(play.state).next()
    if (sale.kind !== 'sell') throw Error('The exchanged share can be sold')
    const details = sale.sales[0]
    play.act('SellFundingShares', {
        seller: details.seller,
        companyId: 'NYC',
        shares: 1,
        expectedProceeds: details.proceeds
    })
    const contribution = funding(play.state).next()
    if (contribution.kind !== 'contribute') throw Error('The sale funds the shortfall')
    play.act('ContributeTrainFunds', { owner: contribution.owner, amount: contribution.amount })
    const buy = funding(play.state).next()
    if (buy.kind !== 'buy') throw Error('The company can buy its required train')
    play.act('BuyTrain', {
        companyId: buy.purchase.companyId,
        trainId: buy.purchase.trainId,
        definitionId: buy.purchase.definitionId,
        expectedPrice: buy.purchase.price
    })
    expect(play.state.bankruptcy).toBeUndefined()
    expect(play.state.trainFunding).toBeUndefined()
})

it('allows the responsible player to declare bankruptcy without using the optional exchange', () => {
    const play = otherwiseBankrupt()
    begin(play)
    expect(() => play.act('DeclareBankruptcy', {}, 'casey')).toThrow()
    play.act('DeclareBankruptcy')
    expect(play.state.machineState).toBe('GameOver')
    expect(play.state.bankruptcy?.playerId).toBe('blair')
    expect(getCompany(play.state, 'MH').closed).not.toBe(true)
})

it('keeps the train and sales obligation when an exchange changes the operating company’s president', () => {
    const play = position('casey', (state) => {
        assertExists(state.operatingSet, 'An operating set is active')
        state.operatingSet.completedCompanyIds = ['PRR']
        state.trainPurchaseStep = { companyId: 'NYC', purchasedTrainIds: [] }
        state.activePlayerIds = ['alex']
        state.trainInventory.trains = state.trainInventory.trains.map((train) =>
            train.status === 'owned' &&
            train.owner.kind === 'company' &&
            train.owner.companyId === 'NYC'
                ? unownedTrain(train, 'removed')
                : train
        )
        state.stations = state.stations.map((station) => ({
            ...station,
            companyId:
                station.companyId === 'PRR'
                    ? 'NYC'
                    : station.companyId === 'NYC'
                      ? 'PRR'
                      : station.companyId
        }))
        for (const cash of state.cash)
            if (cash.owner.kind === 'company' && cash.owner.companyId === 'NYC') cash.amount = 0
        // Both players hold 30%; the fourth share gives Casey the presidency.
        const additions = state.certificates
            .filter((certificate) => !certificate.retired)
            .filter(
                (certificate) =>
                    certificate.companyId === 'NYC' && certificate.owner.kind === 'bank'
            )
            .slice(0, 2)
        for (const certificate of additions) {
            certificate.owner = { kind: 'player', playerId: 'casey' }
            delete certificate.poolId
        }
    })
    begin(play)
    const purchase = play.state.trainFunding?.purchase
    const next = funding(play.state).next()
    if (next.kind !== 'sell') throw Error('Alex must raise funds')
    const sale = next.sales.find(
        (sale) => sale.sales[0].companyId === 'PRR' && sale.sales[0].shares === 1
    )
    assertExists(sale, 'Alex may sell a PRR share before M&H is exchanged')
    play.act('SellFundingShares', {
        seller: sale.seller,
        companyId: 'PRR',
        shares: 1,
        expectedProceeds: sale.proceeds
    })
    const sales = structuredClone(play.state.trainFunding?.sales)
    exchange(play, 'casey')
    expect(getCompany(play.state, 'NYC').president).toEqual({ kind: 'player', playerId: 'casey' })
    expect(play.state.trainFunding?.purchase).toEqual(purchase)
    expect(play.state.trainFunding?.sales).toEqual(sales)
    expect(play.state.trainFunding?.playerId).toBe('casey')
    expect(play.state.trainFunding?.contributors).toEqual([{ kind: 'player', playerId: 'casey' }])
    expect(play.state.activePlayerIds).toEqual(['casey'])
    expect(play.valid('alex')).toEqual([])
    expect(play.state.machineState).toBe('FundingTrain')
})
