import { describe, expect, it } from 'vitest'
import { ActionSource, GameEngine, GameStorage, PlayerStatus } from '@tabletop/common'
import {
    cashOwnedBy,
    getCompany,
    isBuyShares,
    evaluateSharePurchase,
    sameOwner,
    type BuyShares,
    type FinanceExampleState,
    type President
} from '@tabletop/18xx'
import { Definition as Top, TheOldPrinceSharePurchaseRules } from '@tabletop/the-old-prince'
import { Definition as Shikoku, Shikoku1889SharePurchaseRules } from '@tabletop/shikoku-1889'

const alex = { kind: 'player', playerId: 'alex' } as const
const union = { kind: 'company', companyId: 'UB' } as const
const bank = { kind: 'bank' } as const
function example(definition: typeof Top) {
    const game = definition.runtime.initializer.initializeGame(
        {
            id: 'purchase-example',
            typeId: definition.info.id,
            name: 'Purchase example',
            ownerId: 'user',
            storage: GameStorage.Local,
            hotseat: true,
            seed: 5,
            players: ['alex', 'blair', 'casey'].map((id) => ({
                id,
                name: id,
                isHuman: true,
                status: PlayerStatus.Joined
            }))
        },
        definition
    )
    const engine = new GameEngine(definition.runtime)
    return { game, engine, state: engine.startGame(game).initialState }
}
function purchase(certificateId: string, price: number, buyer: President = alex): BuyShares {
    return {
        id: 'buy',
        gameId: 'purchase-example',
        source: ActionSource.User,
        type: 'BuyShares',
        playerId: 'alex',
        buyer,
        certificateId,
        expectedPrice: price
    }
}

it.each([
    {
        definition: Shikoku,
        certificateId: 'AR:share:5',
        price: 65,
        buyer: alex,
        recipient: bank,
        balance: 6185,
        playerCash: 175
    },
    {
        definition: Shikoku,
        certificateId: 'AR:share:4',
        price: 90,
        buyer: alex,
        recipient: bank,
        balance: 6210,
        playerCash: 150
    },
    {
        definition: Top,
        certificateId: 'ML:share:5',
        price: 92,
        buyer: alex,
        recipient: bank,
        balance: 'unlimited',
        playerCash: 148
    },
    {
        definition: Top,
        certificateId: 'ML:share:7',
        price: 92,
        buyer: alex,
        recipient: { kind: 'company', companyId: 'ML' } as const,
        balance: 1012,
        playerCash: 148
    },
    {
        definition: Top,
        certificateId: 'ML:share:5',
        price: 92,
        buyer: union,
        recipient: bank,
        balance: 'unlimited',
        playerCash: 188
    },
    {
        definition: Top,
        certificateId: 'ML:share:7',
        price: 92,
        buyer: union,
        recipient: { kind: 'company', companyId: 'ML' } as const,
        balance: 1012,
        playerCash: 188
    }
])(
    'settles $definition.info.id $certificateId for $buyer.kind and round-trips history',
    ({ definition, certificateId, price, buyer, recipient, balance, playerCash }) => {
        const { game, engine, state } = example(definition)
        const before = structuredClone(state)
        const { updatedState, processedActions } = engine.executeCanonicalAction({
            game,
            state,
            action: purchase(certificateId, price, buyer)
        })
        expect(state).toEqual(before)
        expect(cashOwnedBy(updatedState, alex)).toBe(playerCash)
        expect(cashOwnedBy(updatedState, recipient)).toBe(balance)
        expect(
            updatedState.certificates.find((certificate) => certificate.id === certificateId)
        ).toMatchObject({ owner: buyer })
        expect(
            updatedState.certificates.find((certificate) => certificate.id === certificateId)
        ).not.toHaveProperty('poolId')
        expect(updatedState.machineState).toBe('InspectFinances')
        expect(updatedState.activePlayerIds).toEqual(['alex'])
        expect(updatedState.actionCount).toBe(1)
        const [action] = processedActions
        expect(isBuyShares(action)).toBe(true)
        if (!isBuyShares(action)) throw new Error('Expected purchase history')
        expect(action.metadata?.payments).toEqual(
            buyer.kind === 'company'
                ? [
                      { from: union, to: recipient, amount: 40 },
                      { from: alex, to: recipient, amount: 52 }
                  ]
                : [{ from: alex, to: recipient, amount: price }]
        )
        if (buyer.kind === 'company') {
            expect(cashOwnedBy(updatedState, union)).toBe(0)
            expect(updatedState.stockRound.companyPurchases).toEqual(['UB'])
        }
        expect(
            definition.runtime.hydrator
                .hydrateState(JSON.parse(JSON.stringify(updatedState)))
                .dehydrate()
        ).toEqual(updatedState)
        const replay = engine.applyProcessedAction({ game, state: before, action })
        expect(replay).toEqual(updatedState)
        expect(engine.undoProcessedAction({ state: replay, action })).toEqual(before)
        expect(() =>
            engine.executeCanonicalAction({
                game,
                state: updatedState,
                action: purchase(certificateId, price, buyer)
            })
        ).toThrow()
    }
)

describe('purchase rejection', () => {
    const cases: {
        name: string
        change?: (state: FinanceExampleState) => void
        action?: Partial<BuyShares>
    }[] = [
        { name: 'another player acting', action: { playerId: 'blair' } },
        {
            name: 'buying for another player',
            action: { buyer: { kind: 'player', playerId: 'blair' } }
        },
        { name: 'system action', action: { source: ActionSource.System } },
        { name: 'changed price', action: { expectedPrice: 1 } },
        { name: 'missing certificate', action: { certificateId: 'missing' } },
        { name: 'unavailable presidency', action: { certificateId: 'AR:president' } },
        {
            name: 'corporate buyer in 1889',
            action: { buyer: { kind: 'company', companyId: 'IR' } }
        },
        {
            name: 'insufficient cash',
            change: (state) => {
                state.cash.find((cash) => sameOwner(cash.owner, alex))!.amount = 64
            }
        },
        {
            name: 'sale earlier this round',
            change: (state) => {
                state.stockRound.sales.push({ owner: alex, companyId: 'AR' })
            }
        },
        {
            name: 'unfloated company',
            change: (state) => {
                getCompany(state, 'AR').floated = false
            }
        },
        {
            name: 'certificate limit',
            change: (state) => {
                state.certificates.find(
                    (certificate) => certificate.id === 'AR:president'
                )!.certificateLimitCount = 19
            }
        },
        {
            name: 'ownership limit',
            change: (state) => {
                for (const id of [2, 3, 4]) {
                    const certificate = state.certificates.find(
                        (certificate) => certificate.id === `AR:share:${id}`
                    )!
                    if (!certificate.retired) {
                        certificate.owner = alex
                        delete certificate.poolId
                    }
                }
            }
        },
        {
            name: 'presidency change',
            action: { certificateId: 'IR:share:5', expectedPrice: 70 },
            change: (state) => {
                for (const id of [3, 4]) {
                    const certificate = state.certificates.find(
                        (certificate) => certificate.id === `IR:share:${id}`
                    )!
                    if (!certificate.retired) {
                        certificate.owner = alex
                        delete certificate.poolId
                    }
                }
            }
        }
    ]
    it.each(cases)('rejects $name without mutation', ({ change, action }) => {
        const { game, engine, state } = example(Shikoku)
        change?.(state)
        const before = structuredClone(state)
        expect(() =>
            engine.executeCanonicalAction({
                game,
                state,
                action: { ...purchase('AR:share:5', 65), ...action }
            })
        ).toThrow()
        expect(state).toEqual(before)
    })
    it('rejects TOP reserved shares and a second Union Bank purchase in the round', () => {
        const { state } = example(Top)
        expect(
            evaluateSharePurchase(state, purchase('ML:share:8', 92), TheOldPrinceSharePurchaseRules)
                .reason
        ).toContain('not available')
        state.stockRound.companyPurchases.push('UB')
        expect(
            evaluateSharePurchase(
                state,
                purchase('ML:share:5', 92, union),
                TheOldPrinceSharePurchaseRules
            ).reason
        ).toContain('cannot buy')
        expect(
            evaluateSharePurchase(state, purchase('ML:share:5', 92), TheOldPrinceSharePurchaseRules)
                .details
        ).toBeDefined()
    })
    it('requires enough combined funds for Union Bank and preserves the incumbent on ties', () => {
        const { state } = example(Top)
        state.cash.find((cash) => sameOwner(cash.owner, alex))!.amount = 51
        expect(
            evaluateSharePurchase(
                state,
                purchase('ML:share:5', 92, union),
                TheOldPrinceSharePurchaseRules
            ).reason
        ).toContain('cannot afford')
        const { state: shikoku } = example(Shikoku)
        expect(
            evaluateSharePurchase(
                shikoku,
                purchase('IR:share:5', 70),
                Shikoku1889SharePurchaseRules
            ).details
        ).toBeDefined()
    })
    it('replaces client-supplied settlement metadata with the authoritative details', () => {
        const { game, engine, state } = example(Top)
        const action = purchase('ML:share:5', 92, union)
        action.metadata = {
            certificateId: 'wrong',
            companyId: 'wrong',
            buyer: alex,
            seller: bank,
            price: 1,
            payments: []
        }
        const result = engine.executeCanonicalAction({ game, state, action })
        const record = result.processedActions[0]
        if (!isBuyShares(record)) throw new Error('Expected purchase')
        expect(record.metadata?.price).toBe(92)
        expect(record.metadata?.buyer).toEqual(union)
        expect(record.metadata?.payments).toHaveLength(2)
    })
})
