import { expect, it } from 'vitest'
import { ActionSource, type GameAction } from '@tabletop/common'
import {
    Definition as Top,
    TheOldPrinceTrainFundingRules,
    TheOldPrinceStockRules,
    TheOldPrinceTrainRules
} from '@tabletop/the-old-prince'
import {
    Definition as Shikoku,
    Shikoku1889TrainFundingRules,
    Shikoku1889StockRules,
    Shikoku1889TrainRules
} from '@tabletop/shikoku-1889'
import {
    EmergencyTrainFunding,
    sameOwner,
    type Owner,
    cashOwnedBy,
    getCompany,
    companyMarketSpace,
    type EighteenXXState,
    type FundingChoice
} from '@tabletop/18xx'
import { example } from './stockTestUtils.js'
const Titles = [
    {
        definition: Top,
        rules: TheOldPrinceTrainFundingRules,
        stocks: TheOldPrinceStockRules,
        trains: TheOldPrinceTrainRules
    },
    {
        definition: Shikoku,
        rules: Shikoku1889TrainFundingRules,
        stocks: Shikoku1889StockRules,
        trains: Shikoku1889TrainRules
    }
]
function action(state: EighteenXXState, type: string, fields: object = {}): GameAction {
    return {
        id: `${type}:${state.actionCount}`,
        gameId: state.gameId,
        source: ActionSource.User,
        type,
        playerId: state.activePlayerIds[0],
        ...fields
    }
}
function nextAction(state: EighteenXXState, choice: FundingChoice): GameAction {
    switch (choice.kind) {
        case 'issue':
            return action(state, 'IssueTreasuryShares', {
                expectedProceeds: choice.details.proceeds
            })
        case 'contribute':
            return action(state, 'ContributeTrainFunds', {
                owner: choice.owner,
                amount: choice.amount
            })
        case 'sell': {
            const sale = choice.sales.at(-1)!
            return action(state, 'SellFundingShares', {
                seller: choice.owner,
                companyId: sale.sales[0].companyId,
                shares: sale.sales[0].shares,
                expectedProceeds: sale.proceeds
            })
        }
        case 'buy':
            return action(state, 'BuyTrain', {
                companyId: choice.purchase.companyId,
                trainId: choice.purchase.trainId,
                definitionId: choice.purchase.definitionId,
                expectedPrice: choice.purchase.price
            })
        default:
            throw Error('Bankruptcy is automatic')
    }
}
it.each(Titles)(
    'funds a required train through the canonical engine: $definition.info.id',
    ({ definition, rules, stocks, trains }) => {
        const { game, engine, state } = example(definition, 'funding')
        const funding = new EmergencyTrainFunding(state, rules, stocks, trains)
        const purchase = funding.purchases()[0]
        expect(purchase).toBeDefined()
        let result = engine.executeCanonicalAction({
            game,
            state,
            action: action(state, 'FundTrain', {
                companyId: purchase.companyId,
                trainId: purchase.trainId,
                definitionId: purchase.definitionId,
                expectedPrice: purchase.price
            })
        })
        expect(result.updatedState.machineState).toBe('FundingTrain')
        const initial = result.updatedState
        const contributed: Owner[] = []
        for (
            let index = 0;
            result.updatedState.trainFunding && !result.updatedState.bankruptcy && index < 20;
            index++
        ) {
            const before = result.updatedState
            const next = new EmergencyTrainFunding(before, rules, stocks, trains).next()
            if (next.kind === 'contribute') {
                expect(contributed.some((owner) => sameOwner(owner, next.owner))).toBe(false)
                contributed.push(next.owner)
            }
            if (next.kind === 'sell')
                expect(contributed.some((owner) => sameOwner(owner, next.owner))).toBe(false)
            const selected = nextAction(before, next)
            expect(() =>
                engine.executeCanonicalAction({
                    game,
                    state: before,
                    action: { ...selected, playerId: 'casey' }
                })
            ).toThrow()
            expect(() =>
                engine.executeCanonicalAction({
                    game,
                    state: before,
                    action: action(before, 'FinishOperatingTurn', { companyId: purchase.companyId })
                })
            ).toThrow()
            result = engine.executeCanonicalAction({ game, state: before, action: selected })
            expect(
                definition.runtime.hydrator
                    .hydrateState(JSON.parse(JSON.stringify(result.updatedState)))
                    .dehydrate()
            ).toEqual(result.updatedState)
            expect(result.updatedState.stockRound).toEqual(initial.stockRound)
            let replay = before
            for (const processed of result.processedActions)
                replay = engine.applyProcessedAction({ game, state: replay, action: processed })
            expect(replay).toEqual(result.updatedState)
            let undone = result.updatedState
            for (const processed of [...result.processedActions].reverse())
                undone = engine.undoProcessedAction({ state: undone, action: processed })
            expect(undone).toEqual(before)
        }
        expect(result.updatedState.bankruptcy).toBeUndefined()
        expect(result.updatedState.trainFunding).toBeUndefined()
        expect(result.updatedState.machineState).toBe(
            definition === Top ? 'LayingTrack' : 'OperatingSet'
        )
        expect(
            result.updatedState.trainInventory.trains.find((train) => train.id === purchase.trainId)
        ).toMatchObject({
            status: 'owned',
            owner: { kind: 'company', companyId: purchase.companyId }
        })
        expect(result.updatedState.phaseId).toBe(purchase.definitionId)
    }
)
it.each(Titles)(
    'ends immediately when no funding sources remain: $definition.info.id',
    ({ definition, rules, stocks, trains }) => {
        const { game, engine, state } = example(definition, 'bankruptcy')
        const purchase = new EmergencyTrainFunding(state, rules, stocks, trains).purchases()[0]
        expect(purchase).toBeDefined()
        const result = engine.executeCanonicalAction({
            game,
            state,
            action: action(state, 'FundTrain', {
                companyId: purchase.companyId,
                trainId: purchase.trainId,
                definitionId: purchase.definitionId,
                expectedPrice: purchase.price
            })
        })
        expect(result.updatedState.machineState).toBe('GameOver')
        expect(result.updatedState.bankruptcy?.shortfall).toBe(purchase.price)
        expect(result.updatedState.activePlayerIds).toEqual([])
        expect(result.processedActions.map((action) => action.type)).toEqual([
            'FundTrain',
            'DeclareBankruptcy',
            'ScheduleGameEnd',
            'EndGame'
        ])
        expect(
            engine.getValidActionTypesForPlayer(game, result.updatedState, state.activePlayerIds[0])
        ).toEqual([])
    }
)
it.each(Titles)(
    'rejects unnecessary funding, stale prices, and optional actions while funding: $definition.info.id',
    ({ definition, rules, stocks, trains }) => {
        const { game, engine, state } = example(definition, 'funding')
        const purchase = new EmergencyTrainFunding(state, rules, stocks, trains).purchases()[0]
        const request = {
            companyId: purchase.companyId,
            trainId: purchase.trainId,
            definitionId: purchase.definitionId,
            expectedPrice: purchase.price
        }
        expect(() =>
            engine.executeCanonicalAction({
                game,
                state,
                action: action(state, 'FundTrain', {
                    ...request,
                    expectedPrice: purchase.price + 1
                })
            })
        ).toThrow()
        const funded = engine.executeCanonicalAction({
            game,
            state,
            action: action(state, 'FundTrain', request)
        }).updatedState
        for (const type of [
            'OfferPurchase',
            'ExchangePrivate',
            'BuyPrivateTrain',
            'FinishOperatingTurn',
            'FundTrain'
        ])
            expect(
                engine.getValidActionTypesForPlayer(game, funded, funded.activePlayerIds[0])
            ).not.toContain(type)
        const companyCash = state.cash.find(
            (cash) => cash.owner.kind === 'company' && cash.owner.companyId === purchase.companyId
        )!
        companyCash.amount = purchase.price
        expect(new EmergencyTrainFunding(state, rules, stocks, trains).purchases()).toEqual([])
        expect(() =>
            engine.executeCanonicalAction({
                game,
                state,
                action: action(state, 'FundTrain', request)
            })
        ).toThrow()
    }
)
it('uses company, Union Bank, and player balances in order, contributing only the shortfall', () => {
    const { game, engine, state } = example(Top, 'funding')
    const union = { kind: 'company', companyId: 'UB' } as const
    getCompany(state, 'ML').president = union
    getCompany(state, 'So').president = { kind: 'player', playerId: 'blair' }
    for (const certificate of state.certificates) {
        if (certificate.retired || certificate.kind !== 'share') continue
        if (certificate.id === 'ML:president') certificate.owner = union
        else if (certificate.id === 'So:president')
            certificate.owner = { kind: 'player', playerId: 'blair' }
        else if (certificate.owner.kind === 'company' && certificate.owner.companyId === 'UB') {
            certificate.owner = { kind: 'bank' }
            certificate.poolId = 'market'
        }
    }
    state.cash.find(
        (cash) => cash.owner.kind === 'company' && cash.owner.companyId === 'UB'
    )!.amount = 10
    state.cash.find(
        (cash) => cash.owner.kind === 'company' && cash.owner.companyId === 'ML'
    )!.amount = 0
    const funding = (value: EighteenXXState) =>
        new EmergencyTrainFunding(
            value,
            TheOldPrinceTrainFundingRules,
            TheOldPrinceStockRules,
            TheOldPrinceTrainRules
        )
    const purchase = funding(state).purchases()[0]
    let current = engine.executeCanonicalAction({
        game,
        state,
        action: action(state, 'FundTrain', {
            companyId: purchase.companyId,
            trainId: purchase.trainId,
            definitionId: purchase.definitionId,
            expectedPrice: purchase.price
        })
    }).updatedState
    expect(current.trainFunding?.contributors).toEqual([
        union,
        { kind: 'player', playerId: 'alex' }
    ])
    const payments: { owner: object; amount: number }[] = []
    for (let i = 0; current.trainFunding && !current.bankruptcy && i < 20; i++) {
        const next = funding(current).next()
        if (next.kind === 'contribute') payments.push({ owner: next.owner, amount: next.amount })
        current = engine.executeCanonicalAction({
            game,
            state: current,
            action: nextAction(current, next)
        }).updatedState
    }
    expect(current.bankruptcy).toBeUndefined()
    expect(payments[0]).toEqual({ owner: union, amount: 10 })
    expect(payments.slice(1).every((payment) => 'playerId' in payment.owner)).toBe(true)
    expect(cashOwnedBy(current, union)).toBe(0)
    expect(cashOwnedBy(current, { kind: 'company', companyId: 'ML' })).toBe(0)
    expect(payments.reduce((sum, payment) => sum + payment.amount, 0)).toBe(
        purchase.price - companyMarketSpace(state.stockMarket, 'ML').price
    )
})
it('selects the cheapest available 1889 market train and does not permit a more expensive diesel', () => {
    const { state } = example(Shikoku, 'funding')
    state.phaseId = '6'
    const train = state.trainInventory.trains.find((train) => train.definitionId === '3')!
    train.status = 'market'
    const offers = new EmergencyTrainFunding(
        state,
        Shikoku1889TrainFundingRules,
        Shikoku1889StockRules,
        Shikoku1889TrainRules
    ).purchases()
    expect(offers.map((offer) => offer.trainId)).toEqual([train.id])
    expect(offers[0].price).toBe(180)
})
it('exempts PEIR and companies without a route from compulsory funding', () => {
    const { state } = example(Top, 'funding')
    state.trainPurchaseStep!.companyId = 'PEIR'
    const funding = () =>
        new EmergencyTrainFunding(
            state,
            TheOldPrinceTrainFundingRules,
            TheOldPrinceStockRules,
            TheOldPrinceTrainRules
        )
    expect(funding().purchases()).toEqual([])
    state.trainPurchaseStep!.companyId = 'ML'
    state.stations = state.stations.filter((station) => station.companyId !== 'ML')
    expect(funding().purchases()).toEqual([])
})
it('does not use stock-round sale timing and forbids all 1889 presidency transfers', () => {
    const { game, engine, state } = example(Shikoku, 'funding')
    state.stockRound.number = 1
    state.stockRound.turn.bought = true
    state.stockRound.turn.soldBeforeBuying = true
    const model = (value: EighteenXXState) =>
        new EmergencyTrainFunding(
            value,
            Shikoku1889TrainFundingRules,
            Shikoku1889StockRules,
            Shikoku1889TrainRules
        )
    const purchase = model(state).purchases()[0]
    const current = engine.executeCanonicalAction({
        game,
        state,
        action: action(state, 'FundTrain', {
            companyId: purchase.companyId,
            trainId: purchase.trainId,
            definitionId: purchase.definitionId,
            expectedPrice: purchase.price
        })
    }).updatedState
    const next = model(current).next()
    expect(next.kind).toBe('sell')
    if (next.kind !== 'sell') throw Error('Expected sales')
    expect(next.sales.length).toBeGreaterThan(0)
    expect(next.sales.every((sale) => !sale.sales[0].presidency)).toBe(true)
    expect(
        next.sales
            .filter((sale) => sale.sales[0].companyId === 'IR')
            .map((sale) => sale.sales[0].shares)
    ).toEqual([1, 2])
})
it('issues every TOP treasury share as one block even above 30%, then keeps any excess in treasury', () => {
    const { game, engine, state } = example(Top, 'funding')
    for (const certificate of state.certificates) {
        if (
            !certificate.retired &&
            certificate.kind === 'share' &&
            certificate.companyId === 'ML' &&
            !certificate.president &&
            certificate.id !== 'ML:share:1'
        ) {
            certificate.owner = { kind: 'company', companyId: 'ML' }
            certificate.poolId = 'treasury:ML'
        }
    }
    const model = (value: EighteenXXState) =>
        new EmergencyTrainFunding(
            value,
            TheOldPrinceTrainFundingRules,
            TheOldPrinceStockRules,
            TheOldPrinceTrainRules
        )
    const purchase = model(state).purchases()[0]
    const started = engine.executeCanonicalAction({
        game,
        state,
        action: action(state, 'FundTrain', {
            companyId: purchase.companyId,
            trainId: purchase.trainId,
            definitionId: purchase.definitionId,
            expectedPrice: purchase.price
        })
    }).updatedState
    const next = model(started).next()
    expect(next.kind).toBe('issue')
    if (next.kind !== 'issue') throw Error('Expected issuance')
    expect(next.details.sales[0].shares).toBe(7)
    const issued = engine.executeCanonicalAction({
        game,
        state: started,
        action: nextAction(started, next)
    }).updatedState
    expect(model(issued).next().kind).toBe('buy')
    expect(cashOwnedBy(issued, { kind: 'player', playerId: 'alex' })).toBe(40)
    expect(companyMarketSpace(issued.stockMarket, 'ML').id).toBe(
        next.details.sales[0].toMarketSpaceId
    )
})
it('rejects excessive contributions and sales after the shortfall is covered', () => {
    const { game, engine, state } = example(Shikoku, 'funding')
    state.cash.find(
        (cash) => cash.owner.kind === 'player' && cash.owner.playerId === 'blair'
    )!.amount = 1000
    const model = (value: EighteenXXState) =>
        new EmergencyTrainFunding(
            value,
            Shikoku1889TrainFundingRules,
            Shikoku1889StockRules,
            Shikoku1889TrainRules
        )
    const purchase = model(state).purchases()[0]
    const started = engine.executeCanonicalAction({
        game,
        state,
        action: action(state, 'FundTrain', {
            companyId: purchase.companyId,
            trainId: purchase.trainId,
            definitionId: purchase.definitionId,
            expectedPrice: purchase.price
        })
    }).updatedState
    const next = model(started).next()
    expect(next).toMatchObject({ kind: 'contribute', amount: 230 })
    const contribution = nextAction(started, next)
    expect(() =>
        engine.executeCanonicalAction({
            game,
            state: started,
            action: action(started, 'ContributeTrainFunds', {
                owner: { kind: 'player', playerId: 'blair' },
                amount: 231
            })
        })
    ).toThrow()
    const funded = engine.executeCanonicalAction({
        game,
        state: started,
        action: contribution
    }).updatedState
    expect(cashOwnedBy(funded, { kind: 'player', playerId: 'blair' })).toBe(770)
    expect(engine.getValidActionTypesForPlayer(game, funded, 'blair')).toEqual(['BuyTrain'])
})
it('requires 1889 excess ownership sales even when they raise more than the train shortfall', () => {
    const { game, engine, state } = example(Shikoku, 'funding')
    for (const certificate of state.certificates) {
        if (
            !certificate.retired &&
            certificate.kind === 'share' &&
            certificate.companyId === 'IR' &&
            certificate.owner.kind === 'player' &&
            certificate.owner.playerId === 'alex'
        ) {
            certificate.owner = { kind: 'player', playerId: 'blair' }
        }
    }
    state.cash.find(
        (cash) => cash.owner.kind === 'company' && cash.owner.companyId === 'IR'
    )!.amount = 290
    const model = (value: EighteenXXState) =>
        new EmergencyTrainFunding(
            value,
            Shikoku1889TrainFundingRules,
            Shikoku1889StockRules,
            Shikoku1889TrainRules
        )
    const purchase = model(state).purchases()[0]
    const started = engine.executeCanonicalAction({
        game,
        state,
        action: action(state, 'FundTrain', {
            companyId: purchase.companyId,
            trainId: purchase.trainId,
            definitionId: purchase.definitionId,
            expectedPrice: purchase.price
        })
    }).updatedState
    const next = model(started).next()
    expect(next.kind).toBe('sell')
    if (next.kind !== 'sell') throw Error('Expected compulsory ownership correction')
    expect(next.sales.map((sale) => sale.sales[0].shares)).toEqual([2])
    expect(next.sales[0].proceeds).toBeGreaterThan(10)
})
it.each(Titles)(
    'exhausts actual contributions before bankruptcy without double-counting: $definition.info.id',
    ({ definition, rules, stocks, trains }) => {
        const { game, engine, state } = example(definition, 'bankruptcy')
        const owner = state.activePlayerIds[0]
        state.cash.find(
            (cash) => cash.owner.kind === 'player' && cash.owner.playerId === owner
        )!.amount = 9
        const model = (value: EighteenXXState) =>
            new EmergencyTrainFunding(value, rules, stocks, trains)
        const purchase = model(state).purchases()[0]
        const started = engine.executeCanonicalAction({
            game,
            state,
            action: action(state, 'FundTrain', {
                companyId: purchase.companyId,
                trainId: purchase.trainId,
                definitionId: purchase.definitionId,
                expectedPrice: purchase.price
            })
        }).updatedState
        const result = engine.executeCanonicalAction({
            game,
            state: started,
            action: nextAction(started, model(started).next())
        })
        expect(result.processedActions.map((action) => action.type)).toEqual([
            'ContributeTrainFunds',
            'DeclareBankruptcy',
            'ScheduleGameEnd',
            'EndGame'
        ])
        expect(result.updatedState.bankruptcy?.shortfall).toBe(purchase.price - 9)
        expect(cashOwnedBy(result.updatedState, { kind: 'player', playerId: owner })).toBe(0)
        expect(
            cashOwnedBy(result.updatedState, { kind: 'company', companyId: purchase.companyId })
        ).toBe(9)
        let undone = result.updatedState
        for (const processed of [...result.processedActions].reverse())
            undone = engine.undoProcessedAction({ state: undone, action: processed })
        expect(undone).toEqual(started)
    }
)
it('reevaluates 1889 ownership limits when an emergency sale moves into the Orange Zone', () => {
    const { state } = example(Shikoku, 'funding')
    for (const certificate of state.certificates) {
        if (
            !certificate.retired &&
            certificate.kind === 'share' &&
            certificate.companyId === 'IR' &&
            certificate.owner.kind === 'player' &&
            certificate.owner.playerId === 'alex'
        )
            certificate.owner = { kind: 'player', playerId: 'blair' }
    }
    state.stockMarket.stacks.find((stack) => stack.companyIds.includes('IR'))!.spaceId = '7:0'
    state.cash.find(
        (cash) => cash.owner.kind === 'company' && cash.owner.companyId === 'IR'
    )!.amount = 290
    const model = new EmergencyTrainFunding(
        state,
        Shikoku1889TrainFundingRules,
        Shikoku1889StockRules,
        Shikoku1889TrainRules
    )
    state.trainFunding = model.begin(model.purchases()[0])
    const next = model.next()
    expect(next.kind).toBe('sell')
    if (next.kind !== 'sell') throw Error('Expected ownership correction')
    expect(next.sales.map((sale) => sale.sales[0].shares)).toEqual([1])
    expect(next.sales[0].sales[0].toMarketSpaceId).toBe('8:0')
})

it('continues emergency share sales when they exhaust the 1889 bank', () => {
    const { game, engine, state } = example(Shikoku, 'funding')
    state.cash.find((cash) => cash.owner.kind === 'bank')!.amount = 1
    const funding = (value: EighteenXXState) =>
        new EmergencyTrainFunding(
            value,
            Shikoku1889TrainFundingRules,
            Shikoku1889StockRules,
            Shikoku1889TrainRules
        )
    const purchase = funding(state).purchases()[0]
    let result = engine.executeCanonicalAction({
        game,
        state,
        action: action(state, 'FundTrain', {
            companyId: purchase.companyId,
            trainId: purchase.trainId,
            definitionId: purchase.definitionId,
            expectedPrice: purchase.price
        })
    })
    let sold = false
    for (
        let index = 0;
        result.updatedState.trainFunding && !result.updatedState.bankruptcy && index < 20;
        index++
    ) {
        const before = result.updatedState
        const choice = funding(before).next()
        result = engine.executeCanonicalAction({
            game,
            state: before,
            action: nextAction(before, choice)
        })
        if (choice.kind === 'sell') {
            sold = true
            expect(result.updatedState.bank.broken).toBe(true)
            expect(cashOwnedBy(result.updatedState, { kind: 'bank' })).toBe('unlimited')
        }
        let undone = result.updatedState
        for (const processed of [...result.processedActions].reverse())
            undone = engine.undoProcessedAction({ state: undone, action: processed })
        expect(undone).toEqual(before)
    }
    expect(sold).toBe(true)
    expect(result.updatedState.bankruptcy).toBeUndefined()
    expect(
        result.updatedState.trainInventory.trains.find((train) => train.id === purchase.trainId)
    ).toMatchObject({
        status: 'owned',
        owner: { kind: 'company', companyId: purchase.companyId }
    })
})

it.each(Titles)(
    'previews cash funding without changing the game: $definition.info.id',
    ({ definition, rules, stocks, trains }) => {
        const { game, engine, state } = example(definition, 'funding')
        for (const cash of state.cash) if (cash.owner.kind === 'player') cash.amount = 2000
        const before = structuredClone(state)
        const funding = new EmergencyTrainFunding(state, rules, stocks, trains)
        const purchase = funding.purchases()[0]
        const preview = funding.preview(purchase)
        expect(state).toEqual(before)
        expect(preview.requiresSales).toBe(false)
        let result = engine.executeCanonicalAction({
            game,
            state,
            action: action(state, 'FundTrain', {
                companyId: purchase.companyId,
                trainId: purchase.trainId,
                definitionId: purchase.definitionId,
                expectedPrice: purchase.price
            })
        })
        const contributions: { owner: Owner; amount: number }[] = []
        let treasuryProceeds = 0
        while (result.updatedState.trainFunding) {
            const choice = new EmergencyTrainFunding(
                result.updatedState,
                rules,
                stocks,
                trains
            ).next()
            expect(['issue', 'contribute', 'buy']).toContain(choice.kind)
            if (choice.kind === 'contribute')
                contributions.push({ owner: choice.owner, amount: choice.amount })
            if (choice.kind === 'issue') treasuryProceeds += choice.details.proceeds
            result = engine.executeCanonicalAction({
                game,
                state: result.updatedState,
                action: nextAction(result.updatedState, choice)
            })
        }
        expect(preview).toMatchObject({
            contributions,
            treasuryProceeds,
            requiresSales: false,
            amountToRaise: 0,
            choice: { kind: 'buy' }
        })
        expect(
            result.updatedState.trainInventory.trains.find((train) => train.id === purchase.trainId)
        ).toMatchObject({ owner: { kind: 'company', companyId: purchase.companyId } })
    }
)

it('the funding-chain example exhausts Union Bank before its owner sells and buys', () => {
    const { game, engine, state } = example(Top, 'funding-chain')
    const model = (current: EighteenXXState) =>
        new EmergencyTrainFunding(
            current,
            TheOldPrinceTrainFundingRules,
            TheOldPrinceStockRules,
            TheOldPrinceTrainRules
        )
    const purchase = model(state).purchases()[0]
    expect(purchase.price).toBe(160)
    const union = { kind: 'company', companyId: 'UB' } as const
    const alex = { kind: 'player', playerId: 'alex' } as const
    expect(model(state).preview(purchase).choice).toMatchObject({ kind: 'sell', owner: union })
    let result = engine.executeCanonicalAction({
        game,
        state,
        action: action(state, 'FundTrain', {
            companyId: purchase.companyId,
            trainId: purchase.trainId,
            definitionId: purchase.definitionId,
            expectedPrice: purchase.price
        })
    })
    const recorded = [...result.processedActions]
    const choices: FundingChoice[] = []
    for (let i = 0; result.updatedState.trainFunding && i < 10; i++) {
        const next = model(result.updatedState).next()
        choices.push(next)
        result = engine.executeCanonicalAction({
            game,
            state: result.updatedState,
            action: nextAction(result.updatedState, next)
        })
        recorded.push(...result.processedActions)
    }
    expect(choices.map((choice) => choice.kind)).toEqual([
        'sell',
        'contribute',
        'sell',
        'contribute',
        'buy'
    ])
    expect(choices[0]).toMatchObject({ owner: union })
    expect(choices[1]).toMatchObject({ owner: union })
    expect(choices[2]).toMatchObject({ owner: alex })
    expect(choices[3]).toMatchObject({ owner: alex })
    expect(cashOwnedBy(result.updatedState, union)).toBe(0)
    expect(result.updatedState.bankruptcy).toBeUndefined()
    expect(
        result.updatedState.trainInventory.trains.find((train) => train.id === purchase.trainId)
    ).toMatchObject({ owner: { kind: 'company', companyId: purchase.companyId } })
    let undone = result.updatedState
    for (const processed of recorded.toReversed())
        undone = engine.undoProcessedAction({ state: undone, action: processed })
    expect(undone).toEqual(state)
})
