import { expect, it } from 'vitest'
import { ActionSource, assert, assertExists, type GameAction } from '@tabletop/common'
import {
    cashOwnedBy,
    evaluatePurchaseOffer,
    type EighteenXXState,
    type PurchaseOfferRequest
} from '@tabletop/18xx'
import { exampleGame } from '@tabletop/18xx/scenarios'
import { Definition } from './definition/gameDefinition.js'
import {
    EighteenThirtyTrainDepot,
    EighteenThirtyTrainRules,
    EighteenThirtyTransferRules
} from './index.js'
import { EighteenThirtyScenarios } from './scenarios/index.js'

// PRR must buy a train with $70 in its treasury; NYC owns the next train in the depot.
function emergency() {
    const { game, engine, state: initial } = exampleGame(EighteenThirtyScenarios, 'funding', 4)
    let state: EighteenXXState = structuredClone(initial)
    const definitionId = EighteenThirtyTrainDepot.nextDefinitionId(state.trainInventory)
    assertExists(definitionId, 'The depot has trains')
    const train = EighteenThirtyTrainDepot.nextTrain(state.trainInventory, definitionId)
    assertExists(train, 'The depot has a train')
    EighteenThirtyTrainDepot.purchase(state.trainInventory, train.id, definitionId, {
        kind: 'company',
        companyId: 'NYC'
    })
    const face = EighteenThirtyTrainDepot.trainDefinition(definitionId).price
    const act = (type: string, fields: object, playerId = state.activePlayerIds[0]) => {
        const action: GameAction = {
            id: `action:${state.actionCount}`,
            gameId: game.id,
            source: ActionSource.User,
            playerId,
            type,
            ...fields
        }
        state = engine.executeCanonicalAction({ game, state, action }).updatedState
        expect(Definition.runtime.canonicalStateValidator?.Check(state)).toBe(true)
    }
    const request = (price: number): PurchaseOfferRequest => ({
        companyId: 'PRR',
        asset: { kind: 'train', trainId: train.id },
        seller: { kind: 'company', companyId: 'NYC' },
        price
    })
    const reason = (price: number) =>
        evaluatePurchaseOffer(
            state,
            request(price),
            EighteenThirtyTransferRules,
            EighteenThirtyTrainRules
        ).reason
    return {
        get state() {
            return state
        },
        act,
        reason,
        request,
        face,
        trainId: train.id
    }
}

const cash = (state: EighteenXXState, owner: Parameters<typeof cashOwnedBy>[1]) =>
    Number(cashOwnedBy(state, owner))

function transfer(state: EighteenXXState, playerId: string, amount: number) {
    for (const account of state.cash) {
        if (account.owner.kind === 'bank' && typeof account.amount === 'number')
            account.amount -= amount
        if (account.owner.kind === 'player' && account.owner.playerId === playerId)
            account.amount = Number(account.amount) + amount
    }
}

it('lets the president fund another company’s train with their own cash', () => {
    const game = emergency()
    const president = { kind: 'player', playerId: game.state.activePlayerIds[0] } as const
    const nyc = { kind: 'company', companyId: 'NYC' } as const
    const [treasury, personal] = [
        cash(game.state, { kind: 'company', companyId: 'PRR' }),
        cash(game.state, president)
    ]
    const price = treasury + personal
    expect(price).toBeLessThan(game.face)
    expect(game.reason(price)).toBeUndefined()
    expect(game.reason(price + 1)).toBe('The buyer cannot afford the offer.')
    const before = cash(game.state, nyc)
    game.act('OfferPurchase', game.request(price))
    const offer = game.state.purchaseOffer
    assert(offer, 'NYC’s president answers the offer')
    game.act('RespondToPurchaseOffer', { offerId: offer.id, accept: true }, offer.sellerPlayerId)
    expect(cash(game.state, president)).toBe(0)
    expect(cash(game.state, { kind: 'company', companyId: 'PRR' })).toBe(0)
    expect(cash(game.state, nyc)).toBe(before + price)
    expect(
        game.state.trainInventory.trains.find((train) => train.id === game.trainId)
    ).toMatchObject({ owner: { kind: 'company', companyId: 'PRR' } })
})

it('caps the funded price at the train’s face value', () => {
    const game = emergency()
    transfer(game.state, game.state.activePlayerIds[0], 1000)
    expect(game.reason(game.face)).toBeUndefined()
    expect(game.reason(game.face + 1)).toBe('The buyer cannot afford the offer.')
})

it('limits the purchase to the treasury once the company owns a train', () => {
    const game = emergency()
    transfer(game.state, game.state.activePlayerIds[0], 1000)
    const definitionId = EighteenThirtyTrainDepot.nextDefinitionId(game.state.trainInventory)
    assertExists(definitionId, 'The depot has trains')
    const train = EighteenThirtyTrainDepot.nextTrain(game.state.trainInventory, definitionId)
    assertExists(train, 'The depot has a train')
    EighteenThirtyTrainDepot.purchase(game.state.trainInventory, train.id, definitionId, {
        kind: 'company',
        companyId: 'PRR'
    })
    expect(game.reason(70)).toBeUndefined()
    expect(game.reason(71)).toBe('The buyer cannot afford the offer.')
})
