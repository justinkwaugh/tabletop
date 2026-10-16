import { afterEach, describe, expect, it, vi } from 'vitest'
import { sameCoordinates } from '@tabletop/common'
import { GameSession } from '@tabletop/frontend-components'
import {
    ActionSpaceId,
    CompanyId,
    HydratedRailheadsGameState,
    Industry,
    IndustryBoost,
    MachineState,
    PlacementKind,
    printedHex
} from '@tabletop/railheads'
import {
    choose,
    disposeSessions,
    firstTurnTable,
    invest,
    layNothing,
    openSessionOn,
    type PlayedTable
} from '$lib/testing/sessionHarness.js'
import { historyEntries } from '$lib/utils/history.js'
import {
    addPiece,
    pickBoostHex,
    selectCompany,
    selectedCompany,
    stagedPlacements
} from './selection.js'

afterEach(() => {
    disposeSessions()
    vi.restoreAllMocks()
})

function withCash(table: PlayedTable, playerId: string, cash: number): PlayedTable {
    const players = table.state.players.map((player) =>
        player.playerId === playerId ? { ...player, cash } : player
    )
    return { ...table, state: { ...table.state, players } }
}

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

    it('flags the round timer only when an open space costs every coin left on it', () => {
        const table = firstTurnTable()
        expect(openSessionOn(table).roundEndingChoiceAvailable).toBe(false)
        const lastCoin = openSessionOn({ ...table, state: { ...table.state, roundTimer: 1 } })
        expect(lastCoin.roundEndingChoiceAvailable).toBe(true)
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

describe('issuing a share', () => {
    it('stages the company, and Undo clears it before undoing the action', async () => {
        const session = openSessionOn(choose(firstTurnTable(), ActionSpaceId.IssueShare))
        const actionUndo = spyOnActionUndo()
        expect(session.issuableCompanies.length).toBeGreaterThan(1)
        expect(session.issueCompany).toBeUndefined()
        session.selectIssueCompany(CompanyId.KSSE)
        expect(session.issueCompany).toBe(CompanyId.KSSE)
        expect(session.hasManualSelection()).toBe(true)

        await session.undo()
        expect(session.issueCompany).toBeUndefined()
        expect(actionUndo).not.toHaveBeenCalled()

        await session.undo()
        expect(actionUndo).toHaveBeenCalledTimes(1)
    })

    it('auto-selects the only issuable company, and Undo goes straight to the action', async () => {
        const table = choose(firstTurnTable(), ActionSpaceId.IssueShare)
        const state = new HydratedRailheadsGameState(table.state)
        const companies = table.state.companies.map((company) =>
            company.id === CompanyId.KWSE
                ? {
                      ...company,
                      owners: [
                          ...company.owners,
                          ...Array(state.unsoldShares(company.id)).fill('p2')
                      ]
                  }
                : company
        )
        const session = openSessionOn(
            withCash({ ...table, state: { ...table.state, companies } }, 'p1', 2)
        )
        const actionUndo = spyOnActionUndo()
        expect(session.issuableCompanies).toEqual([CompanyId.GBSE])
        expect(session.issueCompany).toBe(session.issuableCompanies[0])
        expect(session.hasManualSelection()).toBe(false)

        await session.undo()
        expect(actionUndo).toHaveBeenCalledTimes(1)
        expect(session.issueCompany).toBe(session.issuableCompanies[0])
    })
})

describe('Off the Rails', () => {
    const STEEL_EAST_OF_BERLIN = printedHex(13, 13)

    it('asks how an industry site develops before staging the disc', async () => {
        const session = openSessionOn(
            choose(firstTurnTable({ offTheRails: true }), ActionSpaceId.LayTrackIII)
        )
        const actionUndo = spyOnActionUndo()
        session.chooseTrackCompany(CompanyId.KPEV)
        await session.clickHex(STEEL_EAST_OF_BERLIN)
        expect(session.boostHex).toEqual(STEEL_EAST_OF_BERLIN)
        expect(session.boostTarget?.kind).toBe(PlacementKind.Disc)
        expect(session.trackTargets).toEqual([])
        expect(session.placements).toEqual([])

        await session.undo()
        expect(session.boostHex).toBeUndefined()
        expect(session.firstCompany).toBe(CompanyId.KPEV)
        expect(actionUndo).not.toHaveBeenCalled()

        await session.clickHex(STEEL_EAST_OF_BERLIN)
        session.chooseBoost(IndustryBoost.Development)
        expect(session.boostHex).toBeUndefined()
        expect(session.placements).toEqual([
            {
                companyId: CompanyId.KPEV,
                coords: STEEL_EAST_OF_BERLIN,
                kind: PlacementKind.Disc,
                boost: IndustryBoost.Development
            }
        ])
    })
})

describe('changing an earlier choice', () => {
    it('clears every later stage of the track selection', () => {
        const piece = (companyId: CompanyId) => ({
            companyId,
            coords: printedHex(12, 12),
            kind: PlacementKind.Disc
        })
        let selection = selectCompany({}, 'first', CompanyId.KBSB)
        selection = addPiece(selection, 'first', piece(CompanyId.KBSB))
        selection = selectCompany(selection, 'second', CompanyId.KPEV)
        selection = addPiece(selection, 'second', piece(CompanyId.KPEV))
        selection = pickBoostHex(selection, printedHex(13, 13))

        selection = selectCompany(selection, 'first', CompanyId.KWSE)
        expect(selectedCompany(selection, 'first')).toBe(CompanyId.KWSE)
        expect(selectedCompany(selection, 'second')).toBeUndefined()
        expect(stagedPlacements(selection)).toEqual([])
        expect(selection.boostHex).toBeUndefined()
    })
})

describe('history', () => {
    function playedRound() {
        return layNothing(choose(firstTurnTable(), ActionSpaceId.LayTrackII))
    }

    it('groups the opening auctions by company, then each turn with its follow-up actions', () => {
        const { actions } = playedRound()
        const entries = historyEntries(actions)
        const offerings = entries.filter((entry) => entry.kind === 'offering')
        expect(offerings.map((entry) => entry.kind === 'offering' && entry.companyId)).toEqual([
            CompanyId.KPEV,
            CompanyId.GBSE,
            CompanyId.KSSE,
            CompanyId.KWSE,
            CompanyId.KBSB
        ])
        const turn = entries.at(-1)
        expect(turn).toMatchObject({
            kind: 'turn',
            playerId: 'p1',
            space: ActionSpaceId.LayTrackII
        })
        expect(turn?.kind === 'turn' && turn.actions).toHaveLength(2)
    })

    it('jumps to an entry and withholds every move while viewing it', async () => {
        const table = playedRound()
        const session = openSessionOn(table)
        expect(session.selectableSpaces).not.toEqual([])
        const entry = historyEntries(table.actions).at(-1)
        const index = entry?.kind === 'turn' ? entry.actions[0].index : undefined
        expect(index).toBeDefined()

        await vi.waitFor(() => expect(session.history.isDisabled()).toBe(false))
        await session.history.goToActionIndex(index!)
        await vi.waitFor(() => expect(session.gameState.actionCount).toBe(index! + 1))
        expect(session.isViewingHistory).toBe(true)
        expect(session.gameState.machineState).toBe(MachineState.LayingTrack)
        expect(session.canAct).toBe(false)
        expect(session.selectableSpaces).toEqual([])
        expect(session.trackTargets).toEqual([])
        await session.chooseSpace(ActionSpaceId.LayTrackII)
        expect(session.isViewingHistory).toBe(true)
        expect(session.gameState.machineState).toBe(MachineState.LayingTrack)
    })
})
