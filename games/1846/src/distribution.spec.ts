import { start, finish, action } from './testSupport.js'
import { describe, expect, it } from 'vitest'
import { ActionSource, Visibility, assert, assertExists } from '@tabletop/common'
import { Runtime } from './definition/gameDefinition.js'
import {
    CanonicalValidator,
    hydrateEighteenFortySixState,
    type EighteenFortySixProjectedState
} from './state.js'
import { BankSize, DraftCompanies, isBlank } from './catalog.js'
import { choicesFor, hiddenDistribution } from './distribution.js'

function money(state: EighteenFortySixProjectedState) {
    return state.cash.reduce((total, cash) => {
        assert(typeof cash.amount === 'number', 'Finite money expected')
        return total + cash.amount
    }, 0)
}
describe('1846 setup and distribution', () => {
    it.each([3, 4, 5])('initializes the second-printing setup for %i players', (count) => {
        const { state } = start(count)
        expect(CanonicalValidator.Check(state)).toBe(true)
        expect(state.removedPrivateIds).toHaveLength(2 * (6 - count))
        expect(state.removedCorporationIds).toHaveLength(5 - count)
        expect(state.removedCorporationIds.every((id) => ['PRR', 'C&O', 'ERIE'].includes(id))).toBe(
            true
        )
        expect(money(state)).toBe(BankSize[count])
        expect(
            state.cash.filter((cash) => cash.owner.kind === 'player').map((cash) => cash.amount)
        ).toEqual(Array(count).fill(400))
        expect(state.priorityDealPlayerId).toBe(state.players[0].playerId)
        expect(state.activePlayerIds).toEqual([state.players.at(-1)?.playerId])
        expect(state.turnManager.turnOrder).toEqual(
            state.players.map((player) => player.playerId).toReversed()
        )
        expect(
            hiddenDistribution(state).participants.find(
                (player) => player.playerId === state.activePlayerIds[0]
            )?.packet
        ).toHaveLength(count + 2)
        expect(
            state.stations
                .filter((station) => station.status === 'placed')
                .map((station) => station.companyId)
                .sort()
        ).toEqual([...state.removedCorporationIds, 'MS', 'BIG4'].sort())
        expect(
            state.certificates.some((certificate) =>
                state.removedCorporationIds.includes(certificate.companyId)
            )
        ).toBe(false)
    })
    it.each([1, 6])('rejects unsupported count %i', (count) =>
        expect(() => start(count)).toThrow('two through five')
    )
    it('rejects non-catalog canonical fields and does not manufacture missing secrets on hydration', () => {
        const { state } = start()
        expect(CanonicalValidator.Check({ ...state, loans: [] })).toBe(false)
        const copy = structuredClone(state)
        delete hiddenDistribution(copy).deck
        expect(CanonicalValidator.Check(copy)).toBe(false)
        expect(hiddenDistribution(hydrateEighteenFortySixState(copy)).deck).toBeUndefined()
    })
    it('rejects wrong actors, unavailable cards, forged system actions and invalid action flags', () => {
        const { game, state, engine } = start()
        const cardId = choicesFor(hydrateEighteenFortySixState(state), state.activePlayerIds[0])[0]
        for (const invalid of [
            {
                ...action(state, cardId),
                playerId: state.players.find((p) => p.playerId !== state.activePlayerIds[0])
                    ?.playerId
            },
            action(state, 'not-in-packet'),
            action(state),
            { ...action(state, cardId), type: 'RevealDraft', source: ActionSource.User },
            { ...action(state, cardId), revealsInfo: false }
        ])
            expect(() => engine.executeCanonicalAction({ game, state, action: invalid })).toThrow()
    })
    it('recycles only the unchosen packet behind the untouched queue and defers payment', () => {
        const { game, state, engine } = start(5)
        const buyer = hiddenDistribution(state).participants.find(
            (p) => p.playerId === state.activePlayerIds[0]
        )!
        assertExists(buyer.packet)
        assertExists(hiddenDistribution(state).deck)
        const cardId = buyer.packet[0]
        const remaining = [
            ...hiddenDistribution(state).deck,
            ...buyer.packet.filter((id) => id !== cardId)
        ]
        const result = engine.executeCanonicalAction({
            game,
            state,
            action: action(state, cardId)
        }).updatedState
        const next = hiddenDistribution(result).participants.find(
            (p) => p.playerId === result.activePlayerIds[0]
        )!
        expect(result.activePlayerIds).toEqual([state.players.at(-2)?.playerId])
        expect(next.packet?.slice(0, Math.min(hiddenDistribution(state).deck.length, 7))).toEqual(
            hiddenDistribution(state).deck.slice(0, 7)
        )
        expect([...(hiddenDistribution(result).deck ?? []), ...(next.packet ?? [])].sort()).toEqual(
            remaining.sort()
        )
        expect(result.cash).toEqual(state.cash)
        expect(result.certificates).toEqual(state.certificates)
        expect(
            hiddenDistribution(result).participants.find((p) => p.playerId === buyer.playerId)
                ?.selections
        ).toEqual([
            {
                cardId,
                price: isBlank(cardId)
                    ? 0
                    : DraftCompanies.find((company) => company.id === cardId)!.price +
                      DraftCompanies.find((company) => company.id === cardId)!.debt
            }
        ])
    })
    it.each([3, 4, 5])(
        'completes varied %i-player drafts and settles independent assets',
        (count) => {
            for (let seed = 1; seed <= 12; seed++) {
                const { state } = finish(count, seed, seed % 2 === 0)
                expect(CanonicalValidator.Check(state)).toBe(true)
                expect(money(state)).toBe(BankSize[count])
                expect(state.purchases).toHaveLength(12 - state.removedPrivateIds.length)
                expect(new Set(state.purchases.map((p) => p.cardId)).size).toBe(
                    state.purchases.length
                )
                expect(state.activePlayerIds).toEqual([state.priorityDealPlayerId])
                expect(state.result).toBeUndefined()
                expect(state.turnManager.turnOrder[0]).toBe(state.priorityDealPlayerId)
                for (const [id, capital, home] of [
                    ['MS', 60, 'C15'],
                    ['BIG4', 40, 'G9']
                ] as const) {
                    expect(
                        state.cash.find(
                            (cash) => cash.owner.kind === 'company' && cash.owner.companyId === id
                        )?.amount
                    ).toBe(capital)
                    expect(state.stations).toContainEqual({
                        id: `${id}:station:1`,
                        companyId: id,
                        status: 'placed',
                        position: { locationId: home, nodeId: 'city', slot: 0 }
                    })
                    expect(state.trainInventory.trains).toContainEqual({
                        id: `${id}:2`,
                        definitionId: '2',
                        status: 'owned',
                        owner: { kind: 'company', companyId: id }
                    })
                }
            }
        }
    )
    it.each([
        ['MS', 80],
        ['BIG4', 60],
        ['MAIL', 0]
    ] as const)(
        'discounts %s to its debt floor %i and forces the next player to take it',
        (id, debt) => {
            const { game, state, engine } = start()
            hiddenDistribution(state).deck = []
            hiddenDistribution(state).remainingCount = 1
            hiddenDistribution(state).finalOffer = { cardId: id, price: debt + 10 }
            for (const player of hiddenDistribution(state).participants)
                player.packet = player.playerId === state.activePlayerIds[0] ? [id] : []
            const expectedOwner = state.turnManager.turnOrder[1]
            const result = engine.executeCanonicalAction({ game, state, action: action(state) })
            expect(result.updatedState.purchases).toEqual([
                { playerId: expectedOwner, cardId: id, price: debt }
            ])
            expect(result.processedActions.map((action) => action.type)).toEqual([
                'PassFinalCompany',
                'RevealDraft'
            ])
            const owned = result.updatedState.certificates.find(
                (certificate) => certificate.companyId === id
            )
            expect(owned && owned.owner).toEqual({
                kind: 'player',
                playerId: expectedOwner
            })
            expect(money(result.updatedState)).toBe(BankSize[3])
        }
    )
    it('replays and reverses an entire draft exactly', () => {
        const { game, engine, initialState, state, actions } = finish(4, 27, true)
        let replay = initialState
        for (const action of actions)
            replay = engine.applyProcessedAction({ game, state: replay, action })
        expect(replay).toEqual(state)
        for (const action of actions.toReversed())
            replay = engine.undoProcessedAction({ state: replay, action })
        expect(replay).toEqual(initialState)
    })
    it('discovers legal choices from an owner projection but requires the host to deal the next packet', () => {
        const { game, state, engine } = start()
        assertExists(Runtime.visibility)
        const playerId = state.activePlayerIds[0]
        const perspective = { kind: 'player', playerId } as const
        const view = Runtime.visibility.state.project(state, perspective)
        expect(engine.getValidActionTypesForPlayer(game, view, playerId, { perspective })).toEqual([
            'ChooseDraftCard'
        ])
        const cardId = choicesFor(hydrateEighteenFortySixState(view), playerId)[0]
        expect(() =>
            engine.executeAction({ game, state: view, action: action(view, cardId), perspective })
        ).toThrow()
        expect(
            engine.executeCanonicalAction({ game, state, action: action(state, cardId) })
                .updatedState.actionCount
        ).toBe(1)
    })
    it('lets the current player buy the last company before it reaches the debt floor', () => {
        const { game, state, engine } = start()
        const playerId = state.activePlayerIds[0]
        hiddenDistribution(state).deck = []
        hiddenDistribution(state).remainingCount = 1
        hiddenDistribution(state).finalOffer = { cardId: 'MS', price: 110 }
        for (const player of hiddenDistribution(state).participants)
            player.packet = player.playerId === playerId ? ['MS'] : []
        const { updatedState } = engine.executeCanonicalAction({
            game,
            state,
            action: action(state, 'MS')
        })
        expect(updatedState.purchases).toEqual([{ playerId, cardId: 'MS', price: 110 }])
        expect(
            updatedState.cash.find(
                (cash) => cash.owner.kind === 'company' && cash.owner.companyId === 'MS'
            )?.amount
        ).toBe(60)
    })
    it('reproduces public setup and secret packets from the same reproduction seed', () => {
        const a = start(5, 2718).state
        const b = start(5, 2718).state
        expect({ ...a, id: b.id }).toEqual(b)
        expect(a.protectedPrng).toMatchObject({ algorithm: 'chacha20-v1' })
    })
    it('re-executes choices deterministically from identical canonical state', () => {
        const { game, state, engine } = start()
        const cardId = choicesFor(hydrateEighteenFortySixState(state), state.activePlayerIds[0])[0]
        const choice = action(state, cardId)
        expect(engine.executeCanonicalAction({ game, state, action: choice }).updatedState).toEqual(
            engine.executeCanonicalAction({ game, state, action: choice }).updatedState
        )
    })
    it('protects packets, choices, action payloads and both history directions for every perspective', () => {
        const { game, engine, initialState, state, actions } = finish(3, 22, true)
        assertExists(Runtime.visibility)
        for (const perspective of [
            ...initialState.players.map((p) => ({ kind: 'player' as const, playerId: p.playerId })),
            { kind: 'spectator' as const }
        ]) {
            const projected = Runtime.visibility.state.project(initialState, perspective)
            expect(hiddenDistribution(projected).deck).toBeUndefined()
            expect(projected.protectedPrng).toEqual({ seed: 0, invocations: 0 })
            expect(projected.masterSeed).toBeUndefined()
            for (const p of hiddenDistribution(projected).participants) {
                const mine = perspective.kind === 'player' && p.playerId === perspective.playerId
                expect(p.packet !== undefined).toBe(mine)
                expect(p.selections !== undefined).toBe(mine)
            }
            expect(hydrateEighteenFortySixState(projected).dehydrate()).toEqual(projected)
            const history = Visibility.projectActionHistory({
                currentState: state,
                actions,
                visibility: Runtime.visibility,
                perspective,
                replay: { game, runtime: Runtime }
            })
            let replay = projected
            for (const recorded of history.actions) {
                if (
                    recorded.type === 'ChooseDraftCard' &&
                    (perspective.kind === 'spectator' || recorded.playerId !== perspective.playerId)
                )
                    expect(recorded).not.toHaveProperty('cardId')
                replay = engine.applyProcessedAction({ game, state: replay, action: recorded })
                expect(hiddenDistribution(replay).deck).toBeUndefined()
                for (const p of hiddenDistribution(replay).participants)
                    if (perspective.kind === 'spectator' || p.playerId !== perspective.playerId) {
                        expect(p.selections).toBeUndefined()
                        expect(p.packet).toBeUndefined()
                    }
            }
            expect(replay.purchases).toEqual(state.purchases)
            expect(replay).toEqual(history.currentState)
            for (const recorded of history.actions.toReversed())
                replay = engine.undoProcessedAction({ state: replay, action: recorded })
            expect(replay).toEqual(projected)
        }
    })
})
