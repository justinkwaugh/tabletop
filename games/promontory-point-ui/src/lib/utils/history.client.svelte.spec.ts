import { afterEach, describe, expect, it } from 'vitest'
import { ActionSource, assertExists, type GameAction, type Visibility } from '@tabletop/common'
import {
    ActionType,
    BoardNodeKind,
    GameEndReason,
    MachineState,
    TownEventKind,
    PromontoryPointRuntime,
    openSpaceIds,
    type PlaceTrack,
    type RailroadId,
    type ScrapTrack,
    type SpaceId
} from '@tabletop/promontory-point'
import {
    dealtTable,
    disposeSessions,
    editedTable,
    openSessionOn,
    settled,
    type Table
} from '$lib/testing/sessionHarness.js'
import {
    seatOf,
    variantConfig,
    withHoldings,
    withNoRoomFor,
    withTownsOpenTo,
    withTurnPieces
} from '@tabletop/promontory-point/testing'
import type { PromontoryPointGameSession } from '$lib/model/session.svelte.js'
import { describeAction, descriptionText } from './actionDescription.js'
import {
    aggregateTurns,
    jumpIndex,
    replaySpan,
    type HistoryRow,
    type HistoryTurn
} from './actionAggregator.js'
import { END_REASON_TEXT, endSummary } from './endSummary.js'

const CP: RailroadId = 'railroad.cp'
const UP: RailroadId = 'railroad.up'
const KP: RailroadId = 'railroad.kp'
const SP: RailroadId = 'railroad.sp'

afterEach(() => {
    disposeSessions()
})

// The harness names each seat by its id.
function rowText(row: HistoryRow): string {
    const text = descriptionText(row.parts, (playerId) => playerId)
    return row.playerId === undefined ? text : `${row.playerId} ${text}`
}

function turnRows(turn: HistoryTurn | undefined): string[] {
    assertExists(turn, 'The turn has an entry')
    return turn.rows.map(rowText)
}

function project(actions: GameAction[], perspective: Visibility.Perspective): GameAction[] {
    return actions.map((action) =>
        PromontoryPointRuntime.visibility.actions.project(action, perspective)
    )
}

type Seen = { viewer: string | undefined; perspective: Visibility.Perspective }

// The actor, another seat and a spectator.
function perspectives(actorId: string, otherSeatId: string): Seen[] {
    return [
        { viewer: actorId, perspective: { kind: 'player', playerId: actorId } },
        { viewer: otherSeatId, perspective: { kind: 'player', playerId: otherSeatId } },
        { viewer: undefined, perspective: { kind: 'spectator' } }
    ]
}

function turnsSeen(session: PromontoryPointGameSession, seen: Seen): HistoryTurn[] {
    return aggregateTurns(
        project(session.actions, seen.perspective),
        session.gameState,
        seen.viewer
    )
}

function openCountry(session: PromontoryPointGameSession, railroadId: RailroadId): SpaceId {
    const spaceId = openSpaceIds(session.gameState.track, railroadId).find(
        (candidate) => !(candidate in session.gameState.towns)
    )
    assertExists(spaceId, `${railroadId} has open country next to its network`)
    return spaceId
}

async function placeAt(
    session: PromontoryPointGameSession,
    railroadId: RailroadId,
    spaceId: SpaceId
) {
    if (session.pickedPiece !== railroadId) session.pressPiece(railroadId)
    await session.placeTrack(spaceId)
    await settled(session)
}

// R-2.2: three placements on open country, then End turn.
async function playTurn(session: PromontoryPointGameSession) {
    for (let placement = 0; placement < 3; placement++) {
        const railroadId = session.handPieces[0]
        assertExists(railroadId, 'A piece is left to place')
        await placeAt(session, railroadId, openCountry(session, railroadId))
    }
    await session.endTurn()
    await settled(session)
}

// Turn 1: the first seat holds CP and UP, the second is short for any Repairs, the third holds 2 CP.
function eventfulTable(): { table: Table; towns: SpaceId[] } {
    const dealt = dealtTable()
    const { state, spaceIds } = withTownsOpenTo(withTurnPieces(dealt.state, [CP, CP, CP]), CP, [
        'tile.price.minus-3',
        'tile.red.hammer',
        'tile.red.dividend'
    ])
    const table = editedTable(dealt, () =>
        withHoldings(state, [
            { money: 20, shares: { [CP]: 1, [UP]: 1 } },
            { money: 0, shares: { [CP]: 1 } },
            { money: 20, shares: { [CP]: 2 } }
        ])
    )
    return { table, towns: spaceIds }
}

describe('history — each action as the actor, another seat and a spectator see it (R-5)', () => {
    it('R-3.1, R-3.2, R-4.2, R-4.3, R-2.2 step 4: turn 1 reads trades, placements, Repairs and the draw', async () => {
        const { table, towns } = eventfulTable()
        const [first, second, third] = [0, 1, 2].map((position) => seatOf(table.state, position))
        const session = await openSessionOn(table)

        await session.buyShare(KP)
        await settled(session)
        await session.sellShare(UP)
        await settled(session)
        await placeAt(session, CP, towns[0])
        await placeAt(session, CP, towns[1])

        // R-4.3, R-4.3-H4: the entry ends with the debtor deciding.
        for (const seen of perspectives(first, second)) {
            const [turn] = turnsSeen(session, seen)
            expect(turn.sellingPlayerId).toBe(second)
            expect(turn.ended).toBe(false)
        }

        await session.payRepairs([CP])
        await settled(session)
        await placeAt(session, CP, towns[2])
        await session.endTurn()
        await settled(session)

        const drawn = session.actions.find((action) => action.type === ActionType.EndTurn)
        assertExists(drawn, 'The turn ended')
        const ownDraw = describeAction(drawn, first)
        assertExists(ownDraw, 'EndTurn is described')
        const ownDrawText = descriptionText(ownDraw, (playerId) => playerId)
        expect(ownDrawText).toMatch(
            /^ended the turn and drew (CP|UP|KP|SP), (CP|UP|KP|SP), (CP|UP|KP|SP)$/
        )

        const opening = [
            'bought a KP share for $5',
            'sold a UP share for $5',
            'placed CP on a −3 town: CP $5 → $2',
            `placed CP on a Repairs town: bills ${first} $2, ${second} $2, ${third} $4; ${second} short`,
            `${second} sold all 1 for $1, paid $1, $1 forgiven`,
            `placed CP on a Dividend town: Dividend pays ${first} $2, ${third} $4`
        ]
        for (const seen of perspectives(first, second)) {
            const [turnOne, turnTwo] = turnsSeen(session, seen)
            expect(turnOne.playerId).toBe(first)
            expect(turnOne.ended).toBe(true)
            expect(turnOne.sellingPlayerId).toBeUndefined()
            expect(turnRows(turnOne)).toEqual([
                ...opening,
                seen.viewer === first ? ownDrawText : 'ended the turn and drew 3'
            ])
            // R-2.2 step 1: the next turn opens with its reveal as the entry's first row.
            expect(turnTwo.playerId).toBe(second)
            expect(turnRows(turnTwo)).toHaveLength(1)
            expect(turnRows(turnTwo)[0]).toMatch(/^revealed (CP|UP|KP|SP)(, (CP|UP|KP|SP)){2}$/)
        }
    })

    it('R-3.3-H1, R-5: a scrap names the piece and its replacement for every seat', async () => {
        const dealt = dealtTable()
        const table = editedTable(dealt, () =>
            withNoRoomFor(withTurnPieces(dealt.state, [KP, CP, UP]), KP, CP)
        )
        const session = await openSessionOn(table)
        session.pressPiece(KP)
        await session.scrapTrack()
        await settled(session)
        const scrap = session.actions.at(-1)
        assertExists(scrap, 'The scrap was sent')
        expect(scrap.type).toBe(ActionType.ScrapTrack)
        const texts = perspectives(seatOf(table.state, 0), seatOf(table.state, 1)).map(
            (seen) => turnRows(turnsSeen(session, seen)[0])[0]
        )
        expect(texts[0]).toMatch(/^set aside KP and drew (CP|UP|KP|SP)$/)
        expect(new Set(texts).size).toBe(1)
    })

    it('R-6.3: the variant End turn says the leftover piece was kept', async () => {
        const dealt = dealtTable({ config: variantConfig(true) })
        const table = editedTable(dealt, () => withTurnPieces(dealt.state, [CP, UP, KP, SP]))
        const session = await openSessionOn(table)
        for (const railroadId of [CP, UP, KP]) {
            await placeAt(session, railroadId, openCountry(session, railroadId))
        }
        await session.endTurn(false)
        await settled(session)
        const [first, second] = [0, 1].map((position) => seatOf(table.state, position))
        const [, , spectator] = perspectives(first, second)
        expect(turnRows(turnsSeen(session, spectator)[0]).at(-1)).toBe(
            'ended the turn, kept a piece and drew 3'
        )
    })

    it('R-4.2, R-1.2: Promontory at the top of the track reads capped', () => {
        const placement: PlaceTrack = {
            id: 'placement',
            gameId: 'game',
            source: ActionSource.User,
            type: ActionType.PlaceTrack,
            playerId: 'p1',
            railroadId: CP,
            spaceId: 'space.0.0',
            metadata: {
                spaceKind: BoardNodeKind.Promontory,
                townEffectId: 'space.0.0',
                outcome: {
                    kind: TownEventKind.PriceChange,
                    railroadId: CP,
                    priceChange: 5,
                    priceIndexBefore: 26,
                    priceIndexAfter: 29,
                    capped: true
                }
            }
        }
        const parts = describeAction(placement, undefined)
        assertExists(parts, 'PlaceTrack is described')
        expect(descriptionText(parts, (playerId) => playerId)).toBe(
            'placed CP at Promontory: CP $22 → $25 (capped)'
        )
    })

    it('R-3.3-H1: a scrap on an empty bag says one placement fewer', () => {
        const scrap: ScrapTrack = {
            id: 'scrap',
            gameId: 'game',
            source: ActionSource.User,
            type: ActionType.ScrapTrack,
            playerId: 'p1',
            railroadId: SP,
            metadata: { bagEmpty: true }
        }
        const parts = describeAction(scrap, 'p2')
        assertExists(parts, 'ScrapTrack is described')
        expect(descriptionText(parts, (playerId) => playerId)).toBe(
            'set aside SP; the bag is empty, one placement fewer'
        )
    })
})

describe('history — turns and rounds (R-2.1, R-2.1-H1, R-2.2)', () => {
    it('R-2.1: turn 1 has an entry before any action, with no reveal row', async () => {
        const table = dealtTable()
        const session = await openSessionOn(table)
        const turns = aggregateTurns(session.actions, session.gameState, undefined)
        expect(turns).toHaveLength(1)
        expect(turns[0]).toMatchObject({
            turnNumber: 1,
            playerId: seatOf(table.state, 0),
            opensRound: true,
            round: 1,
            rows: [],
            ended: false
        })
    })

    it('R-2.1, R-2.1-H1: a round begins each time play returns to the starting seat', async () => {
        const table = dealtTable()
        const session = await openSessionOn(table)
        for (let turn = 0; turn < 4; turn++) await playTurn(session)

        const turns = aggregateTurns(session.actions, session.gameState, undefined)
        const order = session.gameState.turnManager.turnOrder
        expect(turns.map((turn) => turn.playerId)).toEqual([...order, order[0], order[1]])
        expect(turns.map((turn) => turn.opensRound)).toEqual([true, false, false, true, false])
        expect(turns.map((turn) => turn.round)).toEqual([1, 1, 1, 2, 2])
        expect(turns.map((turn) => turn.ended)).toEqual([true, true, true, true, false])
        // Turn 1 opens at setup; every later turn opens with its RevealHand.
        expect(turns[0].actions[0].type).toBe(ActionType.PlaceTrack)
        for (const turn of turns.slice(1)) {
            expect(turn.actions[0].type).toBe(ActionType.RevealHand)
        }
    })

    it('Jump shows the table as the turn ended, and History View offers no choices', async () => {
        const table = dealtTable()
        const session = await openSessionOn(table)
        await playTurn(session)
        await playTurn(session)
        const [turnOne] = aggregateTurns(session.actions, session.gameState, undefined)
        const index = jumpIndex(turnOne)
        assertExists(index, 'Turn 1 has actions')

        await session.history.goToActionIndex(index, { exact: true })
        await settled(session)
        expect(session.isViewingHistory).toBe(true)
        expect(session.actions.at(-1)?.type).toBe(ActionType.EndTurn)
        expect(session.gameState.machineState).toBe(MachineState.StartingTurn)
        expect(session.decidingPlayerId).toBeUndefined()
        expect(session.pickablePieces).toEqual([])
        expect(session.canUndo).toBe(false)
    })

    it("Replay spans the turn's reveal to its end and returns to the live table", async () => {
        const table = dealtTable()
        const session = await openSessionOn(table)
        await playTurn(session)
        await playTurn(session)
        const [, turnTwo] = aggregateTurns(session.actions, session.gameState, undefined)
        const span = replaySpan(turnTwo)
        assertExists(span, 'Turn 2 has actions')
        const reveal = session.actions.find((action) => action.index === span.start)
        const end = session.actions.find((action) => action.index === span.end)
        expect(reveal?.type).toBe(ActionType.RevealHand)
        expect(end?.type).toBe(ActionType.EndTurn)

        const live = session.actions.length
        await session.history.replayRange(span.start, span.end, { holdMs: 0 })
        await settled(session)
        expect(session.isViewingHistory).toBe(false)
        expect(session.actions).toHaveLength(live)
    })
})

describe('history — the end summary (R-6.1, R-6.2, R-6.2-H1)', () => {
    function endedState(winningPlayerIds: (state: Table['state']) => string[]) {
        const dealt = dealtTable()
        const state = withHoldings(dealt.state, [
            { money: 10, shares: { [CP]: 2 } },
            { money: 30 },
            { money: 4, shares: { [CP]: 1, [KP]: 4 } }
        ])
        return {
            ...state,
            machineState: MachineState.EndOfGame,
            priceIndex: { ...state.priceIndex, [CP]: 14, [KP]: 9 },
            bag: { ...state.bag, remaining: 0 },
            winningPlayerIds: winningPlayerIds(state)
        }
    }

    it('R-6.2: money, shares at final prices and totals, highest first, the winner and why', () => {
        const state = endedState((dealt) => [seatOf(dealt, 2)])
        const summary = endSummary(state)
        assertExists(summary, 'The game has ended')
        expect(
            summary.totals.map(({ playerId, money, shareValue, total }) => ({
                playerId,
                money,
                shareValue,
                total
            }))
        ).toEqual([
            { playerId: seatOf(state, 2), money: 4, shareValue: 30, total: 34 },
            { playerId: seatOf(state, 0), money: 10, shareValue: 20, total: 30 },
            { playerId: seatOf(state, 1), money: 30, shareValue: 0, total: 30 }
        ])
        expect(summary.totals[0].holdings[KP]).toEqual({ shares: 4, price: 5, value: 20 })
        expect(summary.winnerIds).toEqual([seatOf(state, 2)])
        expect(summary.reason).toBe(GameEndReason.BagEmpty)
        expect(END_REASON_TEXT[GameEndReason.BagEmpty]).toBe('The bag is empty')
    })

    it('R-6.2-H1: tied leaders all win', () => {
        const state = endedState((dealt) => [seatOf(dealt, 0), seatOf(dealt, 1)])
        expect(endSummary(state)?.winnerIds).toEqual([seatOf(state, 0), seatOf(state, 1)])
    })

    it('no summary before the game ends', () => {
        expect(endSummary(dealtTable().state)).toBeUndefined()
    })
})
