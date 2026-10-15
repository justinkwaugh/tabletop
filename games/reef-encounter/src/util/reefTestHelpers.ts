import { type OffsetCoordinates } from '@tabletop/common'
import { CoralColor, coralCounts } from '../components/colors.js'
import type { ReefEncounterProjectedState } from '../model/gameState.js'
import type { Polyp, Shrimp } from '../model/reef.js'
import { ActionType } from '../definition/actions.js'
import { completeSetup, startTestGame, type TestSession } from './testHelper.js'

export const at = (row: number, col: number): OffsetCoordinates => ({ row, col })
export const polyp = (row: number, col: number, color: CoralColor): Polyp => ({
    coords: at(row, col),
    color
})

// Board 3 (docs/board-map.md): (3,3) and (5,2) are sand, (4,0) is off the board,
// and (3,2) is the extra-growth square. Every coral tile shows its starfish side,
// so grey beats yellow, orange beats pink, white beats yellow and pink beats grey.
export function startOnBoardThree(
    polyps: Polyp[],
    shrimps: Omit<Shrimp, 'boardId'>[] = [],
    playerCount = 2
) {
    const session = startTestGame(playerCount)
    completeSetup(session)
    session.edit((draft) => {
        draft.reefs = [
            { boardId: 3, polyps },
            { boardId: 4, polyps: [] }
        ]
        draft.shrimps = shrimps.map((shrimp) => ({ ...shrimp, boardId: 3 }))
        for (const tile of draft.coralTiles) {
            tile.starfishSideUp = true
        }
    })
    return session
}

export function give(
    session: TestSession,
    change: (player: ReefEncounterProjectedState['players'][number]) => void
) {
    session.edit((draft) => {
        const player = draft.players.find(
            (candidate) => candidate.playerId === session.currentPlayerId()
        )
        if (player) change(player)
    })
}

export function giveSupplyPolyps(session: TestSession, color: CoralColor, count: number) {
    give(session, (player) => {
        player.knownSupplyPolyps = { ...coralCounts(0), [color]: count }
        player.secretSupplyPolyps = coralCounts(0)
        player.secretSupplyPolypCount = 0
        player.larvaCubes = { ...coralCounts(0), [color]: 2 }
    })
}

export function play(session: TestSession, color: CoralColor) {
    return session.act(session.currentPlayerId(), ActionType.PlayLarvaCube, { color })
}

export function place(
    session: TestSession,
    coords: OffsetCoordinates,
    fromConsumed = false,
    boardId = 3
) {
    return session.act(session.currentPlayerId(), ActionType.PlacePolyp, {
        boardId,
        coords,
        fromConsumed
    })
}

export function polypsOn(session: TestSession): Polyp[] {
    return session.state.reefs.find((reef) => reef.boardId === 3)?.polyps ?? []
}

export function colorAt(session: TestSession, coords: OffsetCoordinates) {
    return polypsOn(session).find((p) => p.coords.row === coords.row && p.coords.col === coords.col)
        ?.color
}

export function currentPlayer(session: TestSession) {
    return session.hydrated().getPlayerState(session.currentPlayerId())
}
