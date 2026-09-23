import { getCompany, cashOwnedBy } from '@tabletop/18xx'
import { expect, it } from 'vitest'
import { Color, GameEngine, GameStorage, PlayerStatus } from '@tabletop/common'
import { TopScenarios as Top, ShikokuScenarios as Shikoku } from '../scenarios/definitions.js'
import { EighteenXXStateValidator } from '@tabletop/18xx'

it.each([Top, Shikoku])(
    'round-trips the $info.id finance example through its runtime',
    (definition) => {
        const game = definition.runtime.initializer.initializeGame(
            {
                id: 'example',
                typeId: definition.info.id,
                name: 'Example',
                ownerId: 'user',
                storage: GameStorage.Local,
                hotseat: true,
                seed: 5,
                config: { examplePosition: 'trading' },
                players: ['alex', 'blair', 'casey'].map((id) => ({
                    id,
                    name: id,
                    isHuman: true,
                    status: PlayerStatus.Joined
                }))
            },
            definition
        )
        const { initialState } = new GameEngine(definition.runtime).startGame(game)
        expect(EighteenXXStateValidator.Check(initialState)).toBe(true)
        const state = definition.runtime.hydrator.hydrateState(
            JSON.parse(JSON.stringify(initialState))
        )
        const before = state.dehydrate()
        expect(definition.runtime.hydrator.hydrateState(state).dehydrate()).toEqual(before)
        expect(
            new GameEngine(definition.runtime).getValidActionTypesForPlayer(game, state, 'alex')
        ).toEqual(['BuyShares', 'SellShares', 'FinishStockTurn', 'SetStockInstruction'])
        state.players.reverse()
        state.players.forEach((player) => (player.color = Color.Purple))
        const restored = definition.runtime.hydrator.hydrateState(
            JSON.parse(JSON.stringify(state.dehydrate()))
        )
        expect(restored.companies).toEqual(before.companies)
        expect(restored.bank).toEqual(before.bank)
        expect(restored.cash).toEqual(before.cash)
        expect(restored.certificates).toEqual(before.certificates)
        expect(restored.certificatePools).toEqual(before.certificatePools)
        expect(initialState).not.toHaveProperty('holdings')
        expect(initialState).not.toHaveProperty('finances')
        expect(restored.players).toEqual(state.players)
        restored.cash[0].amount = 0
        expect(before.cash[0].amount).toBe(240)
        restored.cash[0].amount = 240
        expect(cashOwnedBy(restored, { kind: 'player', playerId: 'alex' })).toBe(240)
        const president = restored.certificates.find(
            (certificate) => certificate.kind === 'share' && certificate.president
        )
        if (president?.kind !== 'share') throw new Error('Missing president certificate')
        expect(president.shares).toBe(2)
        expect(president.certificateLimitCount).toBe(1)
        expect(getCompany(restored, president.companyId).shareCount).toBe(10)
        expect(restored.activePlayerIds[0]).toBe('alex')
        expect(Object.keys(definition.runtime.apiActions).sort()).toEqual(
            [
                'ScheduleGameEnd',
                'EndGame',
                ...(definition === Shikoku
                    ? [
                          'ReserveBid',
                          'RaiseAuctionBid',
                          'BuyAuctionLot',
                          'PassAuction',
                          'ResolveAuction'
                      ]
                    : ['OfferAuctionLot', 'BidOnAuctionLot', 'PassAuction', 'ResolveAuction']),
                'FundTrain',
                'IssueTreasuryShares',
                'SellFundingShares',
                'ContributeTrainFunds',
                'DeclareBankruptcy',
                'ContinueOperatingRound',
                'BuyPrivateTrain',
                'DeclinePrivateTile',
                'LayPrivateTile',
                'RespondToTrackConsent',
                'RequestTrackConsent',
                'RespondToPurchaseOffer',
                'OfferPurchase',
                'ExchangePrivate',
                'BuyShares',
                'SellShares',
                'SetStockInstruction',
                'StopStockInstruction',
                'FinishStockTurn',
                'StartCompany',
                'FloatCompany',
                'CompleteStockRound',
                'StartOperatingSet',
                'LayTile',
                'FinishTrack',
                'StartOperatingTurn',
                'PlaceStation',
                'FinishStations',
                'PlaceHomeStations',
                'BuyTrain',
                'RunTrains',
                'DistributeEarnings',
                'StartOperatingRound',
                'FinishOperatingTurn',
                'StartStockRound',
                'AdvancePhase',
                'DiscardTrain',
                'RustTrains',
                ...(definition === Top ? ['SplitCompany'] : [])
            ].sort()
        )
        expect(() =>
            definition.runtime.hydrator.hydrateState({
                ...initialState,
                cash: [...initialState.cash, initialState.cash[0]]
            })
        ).toThrow('Duplicate')
        expect(EighteenXXStateValidator.Check({ ...initialState, unexpected: true })).toBe(false)
    }
)
