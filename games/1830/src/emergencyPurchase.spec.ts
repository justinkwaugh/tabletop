import { expect, it } from 'vitest'
import { assert, assertExists } from '@tabletop/common'
import {
    cashOwnedBy,
    evaluatePurchaseOffer,
    settleCashPayments,
    type EighteenXXState,
    type Owner,
    type PurchaseOfferRequest
} from '@tabletop/18xx'
import { playExample } from '@tabletop/18xx/scenarios'
import {
    EighteenThirtyTrainDepot,
    EighteenThirtyTrainRules,
    EighteenThirtyTransferRules
} from './index.js'
import { EighteenThirtyScenarios } from './scenarios/index.js'

const prr = { kind: 'company', companyId: 'PRR' } as const
const nyc = { kind: 'company', companyId: 'NYC' } as const

function giveNextDepotTrain(state: EighteenXXState, owner: typeof prr | typeof nyc): string {
    const definitionId = EighteenThirtyTrainDepot.nextDefinitionId(state.trainInventory)
    assertExists(definitionId, 'The depot has trains')
    const train = EighteenThirtyTrainDepot.nextTrain(state.trainInventory, definitionId)
    assertExists(train, 'The depot has a train')
    EighteenThirtyTrainDepot.purchase(state.trainInventory, train.id, definitionId, owner)
    return train.id
}

function prrMustBuyWhileNycOwnsTheNextTrain() {
    let trainId = ''
    const play = playExample(EighteenThirtyScenarios, 'funding', 4, (state) => {
        trainId = giveNextDepotTrain(state, nyc)
    })
    const train = play.state.trainInventory.trains.find((train) => train.id === trainId)
    assertExists(train, 'NYC owns the train')
    const face = EighteenThirtyTrainDepot.trainDefinition(train.definitionId).price
    const request = (price: number): PurchaseOfferRequest => ({
        companyId: 'PRR',
        asset: { kind: 'train', trainId },
        seller: nyc,
        price
    })
    const reason = (price: number) =>
        evaluatePurchaseOffer(
            play.state,
            request(price),
            EighteenThirtyTransferRules,
            EighteenThirtyTrainRules
        ).reason
    return { play, request, reason, face, trainId }
}

const cash = (state: EighteenXXState, owner: Owner) => Number(cashOwnedBy(state, owner))

function giveFromBank(state: EighteenXXState, playerId: string, amount: number) {
    settleCashPayments(state, [
        { from: { kind: 'bank' }, to: { kind: 'player', playerId }, amount }
    ])
}

it('lets the president fund another company’s train with their own cash', () => {
    const { play, request, reason, face, trainId } = prrMustBuyWhileNycOwnsTheNextTrain()
    const president = { kind: 'player', playerId: play.state.activePlayerIds[0] } as const
    const price = cash(play.state, prr) + cash(play.state, president)
    expect(cash(play.state, prr)).toBe(70)
    expect(price).toBeLessThan(face)
    expect(reason(price)).toBeUndefined()
    expect(reason(price + 1)).toBe('The buyer cannot afford the offer.')
    const before = cash(play.state, nyc)
    play.act('OfferPurchase', request(price))
    const offer = play.state.purchaseOffer
    assert(offer, 'NYC’s president answers the offer')
    play.act('RespondToPurchaseOffer', { offerId: offer.id, accept: true }, offer.sellerPlayerId)
    expect(cash(play.state, president)).toBe(0)
    expect(cash(play.state, prr)).toBe(0)
    expect(cash(play.state, nyc)).toBe(before + price)
    expect(play.state.trainInventory.trains.find((train) => train.id === trainId)).toMatchObject({
        owner: prr
    })
})

it('caps the funded price at the train’s face value', () => {
    const { play, reason, face } = prrMustBuyWhileNycOwnsTheNextTrain()
    const state = structuredClone(play.state)
    giveFromBank(state, state.activePlayerIds[0], 1000)
    play.replaceState(state)
    expect(reason(face)).toBeUndefined()
    expect(reason(face + 1)).toBe('The buyer cannot afford the offer.')
})

it('limits the purchase to the treasury once the company owns a train', () => {
    const { play, reason } = prrMustBuyWhileNycOwnsTheNextTrain()
    const state = structuredClone(play.state)
    giveFromBank(state, state.activePlayerIds[0], 1000)
    giveNextDepotTrain(state, prr)
    play.replaceState(state)
    expect(reason(70)).toBeUndefined()
    expect(reason(71)).toBe('The buyer cannot afford the offer.')
})

it('refuses a funded offer the company no longer needs when it is answered', () => {
    const { play, request, face, trainId } = prrMustBuyWhileNycOwnsTheNextTrain()
    const prepared = structuredClone(play.state)
    giveFromBank(prepared, prepared.activePlayerIds[0], 1000)
    play.replaceState(prepared)
    play.act('OfferPurchase', request(face))
    const offer = play.state.purchaseOffer
    assert(offer, 'NYC’s president answers the offer')
    const answered = structuredClone(play.state)
    giveNextDepotTrain(answered, prr)
    play.replaceState(answered)
    expect(play.valid(offer.sellerPlayerId)).toContain('RespondToPurchaseOffer')
    expect(() =>
        play.act(
            'RespondToPurchaseOffer',
            { offerId: offer.id, accept: true },
            offer.sellerPlayerId
        )
    ).toThrow()
    play.act('RespondToPurchaseOffer', { offerId: offer.id, accept: false }, offer.sellerPlayerId)
    expect(play.state.trainInventory.trains.find((train) => train.id === trainId)).toMatchObject({
        owner: nyc
    })
})
