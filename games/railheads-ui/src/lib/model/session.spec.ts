import { afterEach, describe, expect, it, vi } from 'vitest'
import { sameCoordinates } from '@tabletop/common'
import { GameSession } from '@tabletop/frontend-components'
import { ActionSpaceId, CompanyId, Industry, MachineState, printedHex } from '@tabletop/railheads'
import {
    choose,
    disposeSessions,
    firstTurnTable,
    invest,
    openSessionOn
} from '$lib/testing/sessionHarness.js'

afterEach(() => {
    disposeSessions()
    vi.restoreAllMocks()
})

function spyOnActionUndo() {
    return vi.spyOn(GameSession.prototype, 'undo').mockResolvedValue()
}

describe('choosing an action', () => {
    it('offers the spaces the Start Player can afford and take', () => {
        const session = openSessionOn(firstTurnTable())
        expect(session.gameState.machineState).toBe(MachineState.ChoosingAction)
        expect(session.myPlayerId).toBe('p1')
        expect(session.selectableSpaces).toContain(ActionSpaceId.LayTrackIII)
        expect(session.consolidatableSpaces).toEqual([])
    })
})

describe('laying track for a choice of companies', () => {
    function layTable() {
        return choose(firstTurnTable(), ActionSpaceId.LayTrackIII)
    }

    it('offers every company the player holds and stages nothing until one is picked', () => {
        const session = openSessionOn(layTable())
        expect(session.firstCompanyOptions.toSorted()).toEqual(
            [CompanyId.KBSB, CompanyId.KPEV, CompanyId.KWSE].toSorted()
        )
        expect(session.firstCompany).toBeUndefined()
        expect(session.trackTargets).toEqual([])
        expect(session.hasManualSelection()).toBe(false)
    })

    it('stages discs and Undo steps back through them, then the company, before undoing an action', async () => {
        const session = openSessionOn(layTable())
        const actionUndo = spyOnActionUndo()
        session.chooseTrackCompany(CompanyId.KBSB)
        const [target] = session.trackTargets
        await session.clickHex(target.coords)
        expect(session.placements).toHaveLength(1)
        expect(session.stagedCost).toBe(target.cost)

        await session.undo()
        expect(session.placements).toEqual([])
        expect(session.firstCompany).toBe(CompanyId.KBSB)
        expect(actionUndo).not.toHaveBeenCalled()

        await session.undo()
        expect(session.firstCompany).toBeUndefined()
        expect(session.hasManualSelection()).toBe(false)

        await session.undo()
        expect(actionUndo).toHaveBeenCalledTimes(1)
    })

    it('previews the staged disc in the shown state without committing it', async () => {
        const session = openSessionOn(layTable())
        session.chooseTrackCompany(CompanyId.KBSB)
        const target = session.trackTargets.find((candidate) =>
            sameCoordinates(candidate.coords, printedHex(9, 31))
        )
        expect(target).toBeDefined()
        const treasury = session.gameState.company(CompanyId.KBSB).treasury
        await session.clickHex(printedHex(9, 31))
        expect(session.shownState.company(CompanyId.KBSB).treasury).toBe(treasury - 2)
        expect(session.gameState.company(CompanyId.KBSB).treasury).toBe(treasury)
        expect(
            session.gameState.track.some((hex) => sameCoordinates(hex.coords, printedHex(9, 31)))
        ).toBe(false)
    })

    it('stops offering hexes once the company’s treasury cannot pay for another disc', async () => {
        const session = openSessionOn(layTable())
        session.chooseTrackCompany(CompanyId.KBSB)
        expect(session.gameState.company(CompanyId.KBSB).treasury).toBe(5)
        while (session.trackTargets.length > 0) {
            await session.clickHex(session.trackTargets[0].coords)
        }
        expect(session.placements).toHaveLength(2)
        expect(session.stagedCost).toBe(4)
    })
})

describe('Industry Investment', () => {
    it('shows each seat’s sealed bid only to its owner', () => {
        const session = openSessionOn(
            invest(choose(firstTurnTable(), ActionSpaceId.IndustryInvestment), Industry.Grain)
        )
        expect(session.gameState.machineState).toBe(MachineState.SealedBidding)
        expect(session.sealedBidding).toBe(true)
        expect(session.industryAuctionView?.minimum).toBe(2)
        expect(session.industryAuctionView?.seats.every((seat) => seat.waiting)).toBe(true)
        expect(session.mayBidZero).toBe(false)
    })
})
