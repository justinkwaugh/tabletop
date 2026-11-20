import { beforeEach, describe, expect, it } from 'vitest'
import { ActionSource, type GameAction } from '@tabletop/common'
import { turnRestart } from './turnRestart.js'

let nextIndex = 0
beforeEach(() => {
    nextIndex = 0
})

function recorded(
    type: string,
    source: ActionSource,
    playerId?: string,
    extra: Partial<GameAction> & { companyId?: string } = {}
): GameAction {
    const index = nextIndex++
    return { id: `a${index}`, gameId: 'g', type, source, playerId, index, ...extra }
}
const user = (type: string, playerId = 'ada', extra = {}) =>
    recorded(type, ActionSource.User, playerId, extra)
const system = (type: string, extra = {}) => recorded(type, ActionSource.System, undefined, extra)
const operatingStart = (companyId: string) => system('StartOperatingTurn', { companyId })

function operatingTurn() {
    const previous = user('FinishOperatingTurn', 'bo')
    const start = operatingStart('PRR')
    const tile = user('LayTile')
    const station = user('PlaceStation')
    const run = user('RunTrains')
    const payout = user('DistributeEarnings')
    return { actions: [previous, start, tile, station, run, payout], tile, payout }
}

describe('turnRestart', () => {
    it('undoes to the first action of the operating turn and names its company', () => {
        const { actions, tile, payout } = operatingTurn()
        expect(turnRestart(actions, payout)).toEqual({
            target: tile,
            undoneCount: 4,
            companyId: 'PRR'
        })
    })

    it('offers nothing when it would undo no more than Undo', () => {
        const { actions, tile } = operatingTurn()
        expect(turnRestart(actions.slice(0, 3), tile)).toBeUndefined()
    })

    it('stays within the current company when one player runs consecutive turns', () => {
        const { actions } = operatingTurn()
        const finish = user('FinishOperatingTurn')
        const next = operatingStart('B&O')
        const tile = user('LayTile')
        const station = user('PlaceStation')
        expect(turnRestart([...actions, finish, next, tile, station], station)).toMatchObject({
            target: tile,
            undoneCount: 2,
            companyId: 'B&O'
        })
    })

    it('restarts a finished turn after the next company ran by itself', () => {
        const { actions, tile } = operatingTurn()
        const finish = user('FinishOperatingTurn')
        const automatic = [
            operatingStart('B&O'),
            system('RunTrains'),
            system('DistributeEarnings'),
            system('FinishOperatingTurn')
        ]
        expect(turnRestart([...actions, finish, ...automatic], finish)).toMatchObject({
            target: tile,
            undoneCount: 5,
            companyId: 'PRR'
        })
    })

    it("starts a stock turn after the previous player's finish", () => {
        const previous = user('FinishStockTurn', 'bo')
        const sell = user('SellShares')
        const buy = user('BuyShares')
        expect(turnRestart([previous, sell, buy], buy)).toEqual({
            target: sell,
            undoneCount: 2,
            companyId: undefined
        })
    })

    it('restarts the stock turn just finished while the next player has not acted', () => {
        const start = system('StartStockRound')
        const sell = user('SellShares')
        const buy = user('BuyShares')
        const finish = user('FinishStockTurn')
        expect(turnRestart([start, sell, buy, finish], finish)).toMatchObject({
            target: sell,
            undoneCount: 3
        })
    })

    it('hides when another player acted during the turn', () => {
        const { actions, payout } = operatingTurn()
        actions.splice(3, 0, user('LayPrivateTileOutOfTurn', 'bo'))
        expect(turnRestart(actions, payout)).toBeUndefined()
    })

    it('hides a turn resumed after a stock round interrupted it', () => {
        const { actions } = operatingTurn()
        const interruption = [
            system('InterruptOperatingTurn'),
            user('FinishStockTurn', 'bo'),
            system('CompleteStockRound'),
            system('ResumeOperatingTurn', { companyId: 'PRR' })
        ]
        const buy = user('BuyTrain')
        const finish = user('FinishOperatingTurn')
        expect(turnRestart([...actions, ...interruption, buy, finish], finish)).toBeUndefined()
    })

    it("hides an action taken after the company's turn ended", () => {
        const { actions } = operatingTurn()
        const finish = system('FinishOperatingTurn')
        const discard = user('DiscardTrain')
        expect(turnRestart([...actions, finish, discard], discard)).toBeUndefined()
    })

    it('hides consecutive actions outside an operating or stock turn', () => {
        const bid = user('BidForCompany')
        const raise = user('BidForCompany')
        expect(turnRestart([user('PassAuction', 'bo'), bid, raise], raise)).toBeUndefined()
    })

    it("ignores another player's standing declaration", () => {
        const { actions, tile, payout } = operatingTurn()
        actions.splice(3, 0, user('SetStockInstruction', 'bo', { outOfTurn: true }))
        expect(turnRestart(actions, payout)).toMatchObject({ target: tile })
    })

    it('hides when the turn starts before what may be undone', () => {
        const { actions, payout } = operatingTurn()
        expect(turnRestart(actions.slice(3), payout)).toBeUndefined()
    })

    it('hides when the turn revealed information', () => {
        const { actions, payout } = operatingTurn()
        actions[3].revealsInfo = true
        expect(turnRestart(actions, payout)).toBeUndefined()
    })
})
