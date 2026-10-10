import { afterEach, describe, expect, it, vi } from 'vitest'
import type { AxialCoordinates } from '@tabletop/common'
import { GameSession } from '@tabletop/frontend-components'
import { ActionSpace, CompanyId, MachineState } from '@tabletop/hill-country-grocers'
import {
    choose,
    disposeSessions,
    firstTurnTable,
    oneGrocerBuildTable,
    openSessionOn,
    twoGrocerBuildTable
} from '$lib/testing/sessionHarness.js'
import type { HcgGameSession } from './session.svelte.js'

afterEach(() => {
    disposeSessions()
    vi.restoreAllMocks()
})

function spyOnActionUndo() {
    return vi.spyOn(GameSession.prototype, 'undo').mockResolvedValue()
}

function otherGrocers(
    session: HcgGameSession,
    coords: AxialCoordinates,
    companyId: CompanyId
): number {
    return session.gameState.companiesIn(coords).filter((present) => present !== companyId).length
}

async function stageFirstHex(session: HcgGameSession) {
    const [target] = session.hexTargets
    await session.clickHex(target)
    expect(session.chosenHexes).toEqual([target])
}

describe('building with a choice of grocers', () => {
    it('offers both grocers and stages nothing until one is picked', () => {
        const session = openSessionOn(twoGrocerBuildTable())
        expect(session.gameState.machineState).toBe(MachineState.BuildingNetwork)
        expect(session.buildCompanyOptions).toEqual([CompanyId.AlamoCity, CompanyId.Verbena])
        expect(session.buildCompany).toBeUndefined()
        expect(session.hexTargets).toEqual([])
        expect(session.hasManualSelection()).toBe(false)
    })

    it('Undo steps back through the staged store, then the grocer, before undoing an action', async () => {
        const session = openSessionOn(twoGrocerBuildTable())
        const actionUndo = spyOnActionUndo()
        session.selectBuildCompany(CompanyId.AlamoCity)
        await stageFirstHex(session)

        await session.undo()
        expect(session.chosenHexes).toEqual([])
        expect(session.buildCompany).toBe(CompanyId.AlamoCity)
        expect(actionUndo).not.toHaveBeenCalled()

        await session.undo()
        expect(session.buildCompany).toBeUndefined()
        expect(session.hasManualSelection()).toBe(false)
        expect(actionUndo).not.toHaveBeenCalled()

        await session.undo()
        expect(actionUndo).toHaveBeenCalledTimes(1)
    })

    it('picking another grocer clears the stores staged for the first', async () => {
        const session = openSessionOn(twoGrocerBuildTable())
        session.selectBuildCompany(CompanyId.AlamoCity)
        await stageFirstHex(session)

        session.selectBuildCompany(CompanyId.Verbena)
        expect(session.buildCompany).toBe(CompanyId.Verbena)
        expect(session.chosenHexes).toEqual([])
    })
})

describe('the cost shown on each buildable hex', () => {
    it('is $2 to the bank plus $1 for each other grocer already there', () => {
        const session = openSessionOn(twoGrocerBuildTable())
        session.selectBuildCompany(CompanyId.AlamoCity)
        expect(session.hexTargets.length).toBeGreaterThan(0)
        for (const target of session.hexTargets) {
            expect(session.placementCost(target)).toBe(
                2 + otherGrocers(session, target, CompanyId.AlamoCity)
            )
        }
    })

    it('prices the next store once one is staged', async () => {
        const session = openSessionOn(twoGrocerBuildTable())
        session.selectBuildCompany(CompanyId.AlamoCity)
        await stageFirstHex(session)
        expect(session.hexTargets.length).toBeGreaterThan(0)
        for (const target of session.hexTargets) {
            expect(session.placementCost(target)).toBe(
                2 + otherGrocers(session, target, CompanyId.AlamoCity)
            )
        }
    })

    it('lets Verbena waive the fees of its costliest store', async () => {
        const session = openSessionOn(twoGrocerBuildTable())
        session.selectBuildCompany(CompanyId.Verbena)
        expect(session.hexTargets.length).toBeGreaterThan(0)
        for (const target of session.hexTargets) {
            expect(session.placementCost(target)).toBe(2)
        }
        await stageFirstHex(session)
        const [staged] = session.chosenHexes
        const stagedFees = otherGrocers(session, staged, CompanyId.Verbena)
        for (const target of session.hexTargets) {
            const targetFees = otherGrocers(session, target, CompanyId.Verbena)
            expect(session.placementCost(target)).toBe(2 + Math.min(stagedFees, targetFees))
        }
    })
})

describe('building for a lone grocer', () => {
    it('chooses the grocer automatically, as no manual step', () => {
        const session = openSessionOn(oneGrocerBuildTable())
        expect(session.buildCompanyOptions).toEqual([CompanyId.CompleteComestibles])
        expect(session.buildCompany).toBe(CompanyId.CompleteComestibles)
        expect(session.hexTargets.length).toBeGreaterThan(0)
        expect(session.hasManualSelection()).toBe(false)
    })

    it('Undo pops the staged store, then skips the automatic grocer to undo the action', async () => {
        const session = openSessionOn(oneGrocerBuildTable())
        const actionUndo = spyOnActionUndo()
        await stageFirstHex(session)

        await session.undo()
        expect(session.chosenHexes).toEqual([])
        expect(actionUndo).not.toHaveBeenCalled()

        await session.undo()
        expect(actionUndo).toHaveBeenCalledTimes(1)
        expect(session.buildCompany).toBe(CompanyId.CompleteComestibles)
    })

    it('Undo with only the automatic grocer goes straight to action undo', async () => {
        const session = openSessionOn(oneGrocerBuildTable())
        const actionUndo = spyOnActionUndo()
        await session.undo()
        expect(actionUndo).toHaveBeenCalledTimes(1)
    })
})

describe('developing a city Balcones Builders cannot pay in full', () => {
    it('stages the city and offers its grocers as payees', async () => {
        const session = openSessionOn(choose(firstTurnTable(), ActionSpace.DevelopTowns))
        expect(session.cityTargets).toContain('san-antonio')
        await session.clickCity('san-antonio')
        expect(session.developCity).toBe('san-antonio')
        expect(session.payeesDue).toBe(1)
        expect(session.payeeOptions).toEqual([CompanyId.AlamoCity, CompanyId.Verbena])
        expect(session.cityTargets).toEqual([])
        expect(session.mayTakeDevelopmentCash).toBe(false)
    })

    it('Undo drops the staged city before undoing an action', async () => {
        const session = openSessionOn(choose(firstTurnTable(), ActionSpace.DevelopTowns))
        const actionUndo = spyOnActionUndo()
        await session.clickCity('san-antonio')

        await session.undo()
        expect(session.developCity).toBeUndefined()
        expect(session.cityTargets).toContain('san-antonio')
        expect(actionUndo).not.toHaveBeenCalled()

        await session.undo()
        expect(actionUndo).toHaveBeenCalledTimes(1)
    })
})

describe('choosing a share to auction', () => {
    it('keeps the latest company picked', () => {
        const session = openSessionOn(choose(firstTurnTable(), ActionSpace.AuctionShare))
        expect(session.gameState.machineState).toBe(MachineState.StartingAuction)
        session.selectAuctionCompany(CompanyId.Verbena)
        session.selectAuctionCompany(CompanyId.AlamoCity)
        expect(session.auctionCompany).toBe(CompanyId.AlamoCity)
    })

    it('Undo drops the picked company before undoing an action', async () => {
        const session = openSessionOn(choose(firstTurnTable(), ActionSpace.AuctionShare))
        const actionUndo = spyOnActionUndo()
        session.selectAuctionCompany(CompanyId.Verbena)

        await session.undo()
        expect(session.auctionCompany).toBeUndefined()
        expect(actionUndo).not.toHaveBeenCalled()

        await session.undo()
        expect(actionUndo).toHaveBeenCalledTimes(1)
    })

    it('previews the opening bid with every player seated and the opener to bid', () => {
        const session = openSessionOn(choose(firstTurnTable(), ActionSpace.AuctionShare))
        expect(session.auctionView).toBeUndefined()
        session.selectAuctionCompany(CompanyId.Verbena)
        const view = session.auctionView
        const openerId = session.myPlayerId
        expect(view?.opening).toBe(true)
        expect(view?.companyId).toBe(CompanyId.Verbena)
        expect(view?.currentBidderId).toBe(openerId)
        expect(view?.seats[0]).toEqual({ playerId: openerId, passed: false })
        expect(view?.seats).toHaveLength(session.gameState.players.length)
        expect(view?.minimumBid).toBe(0)
    })
})

describe('the lifetime of staged choices', () => {
    it('a new visible state clears every staged choice', async () => {
        const session = openSessionOn(twoGrocerBuildTable())
        session.selectBuildCompany(CompanyId.AlamoCity)
        await stageFirstHex(session)

        session.beforeNewState()
        expect(session.buildCompany).toBeUndefined()
        expect(session.chosenHexes).toEqual([])
        expect(session.hasManualSelection()).toBe(false)
    })
})
