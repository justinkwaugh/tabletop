import { describe, expect, it } from 'vitest'
import { finiteCashOwnedBy, getCompany, trainsOwnedBy } from '@tabletop/18xx'
import { auctionMinor, edit, finishStockRound, opened, setCash } from '../test/kit.js'

/** The Nikolaev auctioned, the operating round run to its train purchase. */
function nikolaevBuying(cash: number, loans = 0) {
    const game = opened(3)
    auctionMinor(game, 'N', 100)
    finishStockRound(game)
    edit(game, (state) => {
        setCash(state, 'N', cash)
        if (loans) getCompany(state, 'N').loans = loans
    })
    const steps = ['LayingTrack', 'PlacingStation', 'RunningTrains', 'DistributingEarnings']
    while (steps.includes(game.state.machineState))
        game.act(
            game.valid().includes('FinishTrack')
                ? 'FinishTrack'
                : game.valid().includes('FinishStations')
                  ? 'FinishStations'
                  : game.valid().includes('RunTrains')
                    ? 'RunTrains'
                    : 'DistributeEarnings',
            game.valid().includes('RunTrains')
                ? { companyId: 'N', routes: [] }
                : game.valid().includes('DistributeEarnings')
                  ? { companyId: 'N', choice: 'half-pay' }
                  : { companyId: 'N' }
        )
    return game
}

describe('1861 loans', () => {
    it('borrows the fewest R50 loans a trainless company needs for a bank train (§10.2)', () => {
        const game = nikolaevBuying(60)
        const [train] = game.state.trainInventory.trains.filter((entry) => entry.status === 'depot')
        game.act('BuyTrain', {
            companyId: 'N',
            trainId: train.id,
            definitionId: '2',
            expectedPrice: 100
        })
        const state = game.hydrated
        expect(getCompany(state, 'N').loans).toBe(1)
        // R60 and a loan's R45 after its first interest, less the R100 train.
        expect(finiteCashOwnedBy(state, { kind: 'company', companyId: 'N' })).toBe(5)
        expect(trainsOwnedBy(state, { kind: 'company', companyId: 'N' })).toHaveLength(1)
    })

    it('charges interest on the loans held and repays what it can (§10.8, §10.9)', () => {
        const game = nikolaevBuying(160, 2)
        const settle = game.actions.findLast((action) => action.type === 'SettleLoans')
        expect(settle?.metadata).toMatchObject({ interest: 10 })
        // R160 less R10 interest repays two loans.
        expect(getCompany(game.state, 'N').loans).toBeUndefined()
        expect(finiteCashOwnedBy(game.state, { kind: 'company', companyId: 'N' })).toBe(50)
    })

    it('nationalises a company that cannot pay its interest (§10.8, §11)', () => {
        const game = nikolaevBuying(0, 2)
        const settle = game.actions.findLast((action) => action.type === 'SettleLoans')
        expect(JSON.stringify(settle?.metadata)).toContain('nationalisation')
        expect(getCompany(game.state, 'N').closed).toBe(true)
        expect(game.state.machineState).not.toBe('BuyingTrains')
        // The price falls a space, and a space for each unpaid loan; the owner is paid two shares.
        const details = (
            settle?.metadata as {
                nationalisation: { price: number; payouts: { amount: number }[] }
            }
        ).nationalisation
        expect(details.price).toBe(35)
        expect(details.payouts.map((payout) => payout.amount)).toEqual([70])
        // The RSR takes the Moscow station with the station kept for Moscow.
        expect(game.state.stations.find((station) => station.id === 'RSR:station:1')).toMatchObject(
            { status: 'placed', position: { locationId: 'H8', nodeId: 'city-1' } }
        )
    })
})
