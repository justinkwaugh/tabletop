import { ActionSource, TerminalStateHandler, assertExists, type Game } from '@tabletop/common'
import { describe, expect, it } from 'vitest'
import { EndTurn } from '../actions/endTurn.js'
import { PayRepairs } from '../actions/payRepairs.js'
import { PlaceTrack } from '../actions/placeTrack.js'
import { ScrapTrack } from '../actions/scrapTrack.js'
import { BOARD_GRID, BoardNodeKind, PROMONTORY, type SpaceId } from '../components/board.js'
import { RAILROAD_IDS, type RailroadId } from '../components/railroads.js'
import { isRedTile } from '../components/townTiles.js'
import { ActionType } from '../definition/actions.js'
import { PromontoryPointStateHandlers } from '../definition/stateHandlers.js'
import { MachineState } from '../definition/states.js'
import type { PromontoryPointGameState } from '../model/gameState.js'
import { GameEndReason, gameEndReason } from '../rules/gameEnd.js'
import {
    reaching,
    withEmptyBag,
    withHoldings,
    withTownTile,
    withTrack
} from '../testing/fixtures.js'
import { offered, placeOnOpenCountry, play, type Played } from '../testing/play.js'
import { startGame } from '../testing/startGame.js'
import { withNoRoomFor, withPlacingEnded, withTurnPieces } from '../testing/turnPieces.js'
import { edited, playerOf, turnPlayer } from '../testing/turns.js'

const CP = 'railroad.cp'
const UP = 'railroad.up'
const KP = 'railroad.kp'
const SP = 'railroad.sp'

function seat(state: PromontoryPointGameState, index: number): string {
    const playerId = state.turnManager.turnOrder[index]
    assertExists(playerId, `No seat ${index}`)
    return playerId
}

// Only the named seat is offered anything, and exactly these action types.
function onlyOffered(game: Game, state: PromontoryPointGameState, playerId: string) {
    return Object.fromEntries(
        Object.entries(offered(game, state)).map(([seatId, types]) => [
            seatId,
            seatId === playerId ? types : []
        ])
    )
}

function cascade({ processedActions }: Played): [string, string | undefined][] {
    return processedActions.map(({ type, playerId }) => [type, playerId])
}

// The turn player's pieces placed on open country, one after another.
function placeAll(game: Game, state: PromontoryPointGameState, pieces: RailroadId[]) {
    return pieces.reduce(
        (current, railroadId) => placeOnOpenCountry(game, current, railroadId).state,
        state
    )
}

// R-2.2: a whole turn of three placements on open country, then the end of the turn.
function plainTurn(game: Game, state: PromontoryPointGameState, returnKeptPiece?: boolean): Played {
    const pieces = state.turn?.pieces.slice(0, 3) ?? []
    const placed = placeAll(game, state, pieces)
    return play(game, placed, EndTurn, { playerId: turnPlayer(placed), returnKeptPiece })
}

// A Central Pacific Repairs town one placement away, with the holdings given by seat.
function repairsAhead(holdings: Parameters<typeof withHoldings>[1], pieces: RailroadId[]) {
    const { game, state } = startGame()
    const turn = withTurnPieces(state, pieces)
    const reached = reaching(turn, CP, BoardNodeKind.Town)
    return {
        game,
        spaceId: reached.spaceId,
        state: withHoldings(
            withTownTile(reached.state, reached.spaceId, 'tile.red.hammer'),
            holdings
        )
    }
}

describe('Promontory Point turn engine', () => {
    it('every machine state has its own handler, none a placeholder', () => {
        expect(Object.keys(PromontoryPointStateHandlers).sort()).toEqual(
            Object.values(MachineState).sort()
        )
        for (const handler of Object.values(PromontoryPointStateHandlers)) {
            expect(handler).not.toBeInstanceOf(TerminalStateHandler)
        }
    })

    it('R-2.1, R-2.2: the starting player trades or places; no other seat is offered anything', () => {
        const { game, state } = startGame()
        const playerId = seat(state, 0)

        expect(state.activePlayerIds).toEqual([playerId])
        expect(offered(game, state)).toEqual({
            ...onlyOffered(game, state, playerId),
            [playerId]: [ActionType.BuyShare, ActionType.SellShare, ActionType.PlaceTrack]
        })
    })

    it("R-2.1, R-2.2 step 4, R-6.1: each EndTurn opens the next seat's turn in turn order, wrapping", () => {
        for (const playerCount of [2, 3, 4]) {
            const { game, state: started } = startGame({ playerCount })
            let state = started
            const players: string[] = []
            for (let turn = 0; turn <= playerCount; turn += 1) {
                players.push(turnPlayer(state))
                const ended = plainTurn(game, state)
                const [afterEnd] = ended.states
                expect(afterEnd.machineState).toBe(MachineState.StartingTurn)
                expect(cascade(ended)).toEqual([
                    [ActionType.EndTurn, players.at(-1)],
                    [ActionType.RevealHand, turnPlayer(ended.state)]
                ])
                expect(ended.processedActions[1]?.source).toBe(ActionSource.System)
                expect(ended.state.machineState).toBe(MachineState.TradingBeforePlacing)
                expect(ended.state.activePlayerIds).toEqual([turnPlayer(ended.state)])
                state = ended.state
            }
            const order = state.turnManager.turnOrder
            expect(players).toEqual([...order, order[0]])
        }
    })

    describe('R-2.2-H1, R-2.2-H2: placing closes trading until it ends', () => {
        it('R-2.2-H1: the first placement leads to Placing, which offers only placing, then trading reopens', () => {
            const { game, state } = startGame()
            const turn = withTurnPieces(state, [CP, UP, KP])
            const playerId = turnPlayer(turn)

            const first = placeOnOpenCountry(game, turn, CP).state
            expect(first.machineState).toBe(MachineState.Placing)
            expect(offered(game, first)).toEqual({
                ...onlyOffered(game, first, playerId),
                [playerId]: [ActionType.PlaceTrack]
            })

            const second = placeOnOpenCountry(game, first, UP).state
            expect(second.machineState).toBe(MachineState.Placing)

            const last = placeOnOpenCountry(game, second, KP).state
            expect(last.machineState).toBe(MachineState.TradingAfterPlacing)
            expect(last.activePlayerIds).toEqual([playerId])
            expect(offered(game, last)).toEqual({
                ...onlyOffered(game, last, playerId),
                [playerId]: [ActionType.BuyShare, ActionType.SellShare, ActionType.EndTurn]
            })
        })

        it('R-2.2-H1: TradingBeforePlacing leads straight to TradingAfterPlacing when placing ends at once', () => {
            const { game, state } = startGame()
            const onePieceLeft = edited(withTurnPieces(state, [CP, UP, KP]), (draft) => {
                assertExists(draft.turn, 'The turn is open')
                for (const railroadId of draft.turn.pieces.splice(1)) {
                    draft.scrapped[railroadId] += 1
                }
            })

            const placed = placeOnOpenCountry(game, onePieceLeft, CP).state

            expect(placed.machineState).toBe(MachineState.TradingAfterPlacing)
        })

        it('R-2.2-H2, R-3.3-H1: a scrap with the bag empty leads to Placing with one placement fewer, and the game ends after the turn', () => {
            const { game, state } = startGame()
            const boxedIn = withEmptyBag(withNoRoomFor(withTurnPieces(state, [KP, CP, UP]), KP, UP))
            const playerId = turnPlayer(boxedIn)
            expect(offered(game, boxedIn)[playerId]).toEqual([
                ActionType.BuyShare,
                ActionType.SellShare,
                ActionType.PlaceTrack,
                ActionType.ScrapTrack
            ])

            const scrapped = play(game, boxedIn, ScrapTrack, { playerId, railroadId: KP })
            expect(scrapped.processedActions[0]?.revealsInfo).toBeFalsy()
            expect(scrapped.state.machineState).toBe(MachineState.Placing)
            expect(scrapped.state.turn).toMatchObject({ pieces: [CP, UP], placementsLeft: 2 })
            expect(offered(game, scrapped.state)[playerId]).toEqual([ActionType.PlaceTrack])

            const placed = placeAll(game, scrapped.state, [CP, UP])
            expect(placed.machineState).toBe(MachineState.TradingAfterPlacing)

            const ended = play(game, placed, EndTurn, { playerId })
            expect(cascade(ended)).toEqual([[ActionType.EndTurn, playerId]])
            expect(ended.state.machineState).toBe(MachineState.EndOfGame)
            expect(gameEndReason(ended.state)).toBe(GameEndReason.BagEmpty)
            expect(ended.state.activePlayerIds).toEqual([])
            expect(Object.values(offered(game, ended.state)).flat()).toEqual([])
        })
        it('R-6.3-H4: in the variant a scrap with the bag empty keeps three placements; the held piece is placed, nothing is kept and the draw wants four', () => {
            const { game, state } = startGame({ config: { fourPieceVariant: true } })
            const boxedIn = withEmptyBag(
                withNoRoomFor(withTurnPieces(state, [KP, CP, UP, SP]), KP, UP)
            )
            const playerId = turnPlayer(boxedIn)

            const scrapped = play(game, boxedIn, ScrapTrack, { playerId, railroadId: KP })
            expect(scrapped.state.machineState).toBe(MachineState.Placing)
            expect(scrapped.state.turn).toMatchObject({ pieces: [CP, UP, SP], placementsLeft: 3 })

            const twoPlaced = placeAll(game, scrapped.state, [CP, UP])
            expect(twoPlaced.machineState).toBe(MachineState.Placing)
            const placed = placeAll(game, twoPlaced, [SP])
            expect(placed.machineState).toBe(MachineState.TradingAfterPlacing)
            expect(placed.turn).toMatchObject({ pieces: [], placementsMade: 3, placementsLeft: 0 })
            // Nothing is left over, so there is no keep-or-return choice to make.
            expect(() => play(game, placed, EndTurn, { playerId, returnKeptPiece: false })).toThrow(
                'NoLeftoverPiece'
            )

            const ended = play(game, placed, EndTurn, { playerId })
            expect(ended.processedActions[0]).toMatchObject({
                metadata: { drawn: [], drawnCount: 0, wanted: 4 }
            })
            expect(ended.processedActions[0]).not.toHaveProperty('metadata.leftover')
            expect(playerOf(ended.state, playerId).keptPiece).toBeUndefined()
            expect(playerOf(ended.state, playerId).hand).toEqual([])
            expect(ended.state.machineState).toBe(MachineState.EndOfGame)
            expect(gameEndReason(ended.state)).toBe(GameEndReason.BagEmpty)
        })
    })

    describe('R-4.3-H4: a Repairs waits on its debtors in order, then the turn continues', () => {
        it('R-4.3-H4: two debtors decide in turn, the second not the turn player, then placing goes on', () => {
            const { game, state, spaceId } = repairsAhead(
                [
                    { money: 1, shares: { [CP]: 2, [UP]: 1 } },
                    { money: 10, shares: { [CP]: 1 } },
                    { money: 0, shares: { [CP]: 1, [KP]: 1 } },
                    { money: 3 }
                ],
                [CP, UP, KP]
            )
            const placer = seat(state, 0)
            const secondDebtor = seat(state, 2)
            // R-3.1: every price is 5, beyond the placer's $1.
            expect(offered(game, state)[placer]).toEqual([
                ActionType.SellShare,
                ActionType.PlaceTrack
            ])

            const billed = play(game, state, PlaceTrack, {
                playerId: placer,
                railroadId: CP,
                spaceId
            })
            expect(billed.state.machineState).toBe(MachineState.PayingRepairs)
            expect(billed.state.pendingRepairs?.debtors.map(({ playerId }) => playerId)).toEqual([
                placer,
                secondDebtor
            ])
            expect(billed.state.activePlayerIds).toEqual([placer])
            expect(offered(game, billed.state)).toEqual({
                ...onlyOffered(game, billed.state, placer),
                [placer]: [ActionType.PayRepairs]
            })

            const placerPaid = play(game, billed.state, PayRepairs, {
                playerId: placer,
                sales: [UP, CP]
            })
            expect(placerPaid.state.machineState).toBe(MachineState.PayingRepairs)
            expect(placerPaid.state.activePlayerIds).toEqual([secondDebtor])
            expect(offered(game, placerPaid.state)).toEqual({
                ...onlyOffered(game, placerPaid.state, secondDebtor),
                [secondDebtor]: [ActionType.PayRepairs]
            })
            expect(placerPaid.state.turnManager).toEqual(billed.state.turnManager)

            const allPaid = play(game, placerPaid.state, PayRepairs, {
                playerId: secondDebtor,
                sales: [CP]
            })
            expect(allPaid.state.pendingRepairs).toBeUndefined()
            expect(allPaid.state.machineState).toBe(MachineState.Placing)
            expect(allPaid.state.activePlayerIds).toEqual([placer])
            expect(allPaid.state.turn).toMatchObject({ pieces: [UP, KP], placementsMade: 1 })
            expect(offered(game, allPaid.state)[placer]).toEqual([ActionType.PlaceTrack])
        })

        it('R-4.3-H4: a Repairs on the last placement leads to TradingAfterPlacing once paid', () => {
            const { game, state, spaceId } = repairsAhead(
                [
                    { money: 20, shares: { [CP]: 1 } },
                    { money: 0, shares: { [CP]: 1, [UP]: 1 } }
                ],
                [UP, KP, CP]
            )
            const placer = seat(state, 0)
            const debtor = seat(state, 1)
            const twoPlaced = placeAll(game, state, [UP, KP])

            const billed = play(game, twoPlaced, PlaceTrack, {
                playerId: placer,
                railroadId: CP,
                spaceId
            })
            expect(billed.state.machineState).toBe(MachineState.PayingRepairs)
            expect(billed.state.activePlayerIds).toEqual([debtor])

            const paid = play(game, billed.state, PayRepairs, { playerId: debtor, sales: [CP] })
            expect(paid.state.machineState).toBe(MachineState.TradingAfterPlacing)
            expect(paid.state.activePlayerIds).toEqual([placer])
        })
    })

    describe('R-6.1: the end test after EndTurn', () => {
        it('R-6.1, R-6.1-H1: at most one red tile uncovered and Promontory taken ends the game', () => {
            const { game, state } = startGame()
            const redTowns = BOARD_GRID.spaces()
                .map(({ spaceId }) => spaceId)
                .filter((spaceId) => spaceId in state.towns && isRedTile(state.towns[spaceId]))
            const covering: [SpaceId, RailroadId][] = [
                ...redTowns.slice(1),
                PROMONTORY.spaceId
            ].map((spaceId, index) => [spaceId, RAILROAD_IDS[index % RAILROAD_IDS.length]])
            const ending = withPlacingEnded(withTrack(state, covering))

            const ended = play(game, ending, EndTurn, { playerId: turnPlayer(ending) })

            expect(ended.state.machineState).toBe(MachineState.EndOfGame)
            expect(gameEndReason(ended.state)).toBe(GameEndReason.RedTilesCovered)
            expect(cascade(ended)).toEqual([[ActionType.EndTurn, turnPlayer(ending)]])
        })

        it('R-6.1-H2: a bag emptied by a mid-turn replacement lets the turn finish, then ends the game', () => {
            const { game, state } = startGame()
            const boxedIn = withNoRoomFor(withTurnPieces(state, [KP, CP, UP]), KP, UP)
            const lastPiece = edited(boxedIn, (draft) => {
                for (const railroadId of draft.bag.items.splice(0, draft.bag.remaining - 1)) {
                    draft.scrapped[railroadId] += 1
                }
                draft.bag.remaining = 1
            })
            const playerId = turnPlayer(lastPiece)

            const scrapped = play(game, lastPiece, ScrapTrack, { playerId, railroadId: KP })
            expect(scrapped.state.bag.remaining).toBe(0)
            expect(scrapped.state.machineState).toBe(MachineState.Placing)
            expect(scrapped.state.turn?.placementsLeft).toBe(3)

            const replacement = scrapped.state.turn?.pieces.at(-1)
            assertExists(replacement, 'The replacement joins the turn pieces')
            const placed = placeAll(game, scrapped.state, [CP, UP, replacement])
            expect(placed.machineState).toBe(MachineState.TradingAfterPlacing)

            const ended = play(game, placed, EndTurn, { playerId })
            expect(ended.state.machineState).toBe(MachineState.EndOfGame)
            expect(gameEndReason(ended.state)).toBe(GameEndReason.BagEmpty)
            expect(playerOf(ended.state, playerId).hand).toEqual([])
        })
    })

    it("R-6.3, R-6.3-H2: in the variant one seat keeps its leftover, the next returns it, and the kept piece opens the first seat's next turn", () => {
        const { game, state } = startGame({ playerCount: 2, config: { fourPieceVariant: true } })
        const first = seat(state, 0)
        const second = seat(state, 1)
        expect(state.turn?.pieces).toHaveLength(4)

        const placed = placeAll(game, state, state.turn?.pieces.slice(0, 3) ?? [])
        const leftover = placed.turn?.pieces[0]
        assertExists(leftover, 'A fourth piece is left over')
        expect(offered(game, placed)[first]).toContain(ActionType.EndTurn)
        expect(() => play(game, placed, EndTurn, { playerId: first })).toThrow(
            'KeepOrReturnUnchosen'
        )

        const kept = play(game, placed, EndTurn, { playerId: first, returnKeptPiece: false })
        expect(playerOf(kept.state, first).keptPiece).toBe(leftover)
        expect(turnPlayer(kept.state)).toBe(second)
        expect(kept.state.turn?.pieces).toHaveLength(4)

        const returned = plainTurn(game, kept.state, true)
        const firstHand = playerOf(returned.states[0], first).hand
        expect(playerOf(returned.states[0], second).hand).toHaveLength(4)
        expect(cascade(returned)).toEqual([
            [ActionType.EndTurn, second],
            [ActionType.RevealHand, first]
        ])
        expect(returned.processedActions[1]).toMatchObject({
            metadata: { pieces: [...firstHand, leftover] }
        })
        expect(returned.state.turn?.pieces).toEqual([...firstHand, leftover])
        expect(playerOf(returned.state, first).keptPiece).toBeUndefined()
    })
})
