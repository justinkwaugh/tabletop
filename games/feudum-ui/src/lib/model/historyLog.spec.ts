import { afterEach, describe, expect, it, vi } from 'vitest'
import { flushSync } from 'svelte'
import { assertExists } from '@tabletop/common'
import {
    ActionType,
    HydratedFeudumGameState,
    MachineState,
    placeMarker,
    type SpaceId
} from '@tabletop/feudum'
import { writsNamedIn } from '@tabletop/feudum/testing'
import {
    isHistoryGroup,
    type HistoryGroup,
    type RoundDivider
} from '$lib/utils/actionAggregator.js'
import { askedToDefend, type AskTable } from '$lib/testing/askTable.js'
import { primaryNamed } from '$lib/testing/actionPanelView.js'
import { playOutRound, type RoundEndTable } from '$lib/testing/roundEndTable.js'
import { seatedAtCards } from '$lib/testing/followUpTable.js'
import { settled, type FeudumHost } from '$lib/testing/sessionHarness.js'
import { addPawn, buildFeudum, emptySpace, giveGood, returnGoods } from '$lib/testing/turnTable.js'
import type { BoardAnimator } from '$lib/animators/boardAnimator.svelte.js'
import type { FeudumGameSession } from './session.svelte.js'

const hosts: FeudumHost[] = []

afterEach(() => {
    for (const host of hosts.splice(0)) {
        host.close()
    }
    vi.restoreAllMocks()
})

function hosted<T extends { readonly host: FeudumHost }>(table: T): T {
    hosts.push(table.host)
    return table
}

function groupAt(session: FeudumGameSession, firstIndex: number): HistoryGroup {
    const group = session.historyLog.entries
        .filter(isHistoryGroup)
        .find((entry) => entry.firstIndex === firstIndex)
    assertExists(group, `An entry starts at ${firstIndex}`)
    return group
}

function roundDivider(session: FeudumGameSession, round: number) {
    const divider = session.historyLog.entries.find(
        (entry): entry is RoundDivider => entry.kind === 'round' && entry.round === round
    )
    assertExists(divider, `Round ${round} has its interstitial`)
    return divider
}

/** R-3.13, R-3.14.1 A Conquer let stand and committed: 10, 11 from the other seat, 12. */
async function conquered(): Promise<AskTable> {
    const table = hosted(await askedToDefend(['defend', 'tax']))
    const { asked, session, third } = table
    await primaryNamed(asked.actionPanel, /^Let it stand/).send()
    for (const seat of [asked, session, third]) {
        await settled(seat)
    }
    flushSync()
    await primaryNamed(session.actionPanel, /./).send()
    for (const seat of [asked, session, third]) {
        await settled(seat)
    }
    flushSync()
    return table
}

/** The round played out with no dawn: round 2 starts at 19 on a roll at 17 and its end at 18. */
function roundOver(): Promise<RoundEndTable> {
    return playOutRound(undefined).then(hosted)
}

/** R-4.11.2, R-4.12 The round played out into epoch II: dawn 18, map 19, the round's end 20. */
function dawned(): Promise<RoundEndTable> {
    return playOutRound(2).then(hosted)
}

interface Step {
    readonly index: number | undefined
    readonly fromCount: number | undefined
    readonly toCount: number
    /** All of it this seat's session held and gave its animators at this step. */
    readonly shown: string
}

/** What a replay hands the existing animators, step by step, and what it planned from it. */
function watchSteps(
    session: FeudumGameSession,
    during?: (seen: Parameters<BoardAnimator['onGameStateChange']>[0]) => void
) {
    const steps: Step[] = []
    const { boardAnimator, flightAnimator } = session
    const plans = vi.spyOn(flightAnimator, 'plan')
    const change = boardAnimator.onGameStateChange.bind(boardAnimator)
    vi.spyOn(boardAnimator, 'onGameStateChange').mockImplementation(async (seen) => {
        steps.push({
            index: seen.action?.index,
            fromCount: seen.from?.actionCount,
            toCount: seen.to.actionCount,
            shown: JSON.stringify([
                seen.from?.dehydrate(),
                seen.to.dehydrate(),
                seen.action,
                plans.mock.results.at(-1)?.value
            ])
        })
        during?.(seen)
        return change(seen)
    })
    return steps
}

const hold = { holdMs: 0 }

describe('R-2.2 Jump', () => {
    it('R-2.2 A round shows the table as it began: on StartRound, no hand finalised', async () => {
        const { host, session } = await roundOver()
        expect(host.actions[19].type).toBe(ActionType.StartRound)

        await session.historyLog.jump(roundDivider(session, 2))
        await settled(session)

        expect(session.isViewingHistory).toBe(true)
        expect(session.currentAction?.index).toBe(19)
        expect(session.actions).toHaveLength(20)
        expect(session.gameState.machineState).toBe(MachineState.SelectingHands)
        expect(session.gameState.roundManager.series.at(-1)?.number).toBe(2)
    })

    it('R-2.2 Round 1 likewise, from after it has ended: at 6, before any finaliser', async () => {
        const { host, session } = await roundOver()
        expect(host.actions[6].type).toBe(ActionType.StartRound)

        await session.historyLog.jump(roundDivider(session, 1))
        await settled(session)

        expect(session.currentAction?.index).toBe(6)
        expect(session.gameState.machineState).toBe(MachineState.SelectingHands)
        expect(session.gameState.flow.selection?.finalised).toEqual([])
    })

    it('R-3.2 A turn shows the table as it ended: on its last Action, not the AdvanceTurn after', async () => {
        const { host, seat, session } = await conquered()
        expect(host.actions[12].type).toBe(ActionType.CommitAttack)
        expect(host.actions[13].type).toBe(ActionType.AdvanceTurn)
        const turn = groupAt(session, 10)
        expect(turn.jumpIndex).toBe(12)

        await session.historyLog.jump(turn)
        await settled(session)

        expect(session.currentAction?.index).toBe(12)
        expect(session.gameState.flow.turn?.playerId).toBe(seat)
    })

    it('R-4.12 A dawn shows the table as it ended: its round`s end, not the next round', async () => {
        const { host, session } = await dawned()
        expect(host.actions[20].type).toBe(ActionType.EndRound)
        expect(host.actions[21].type).toBe(ActionType.StartRound)
        const dawn = groupAt(session, 18)
        expect(dawn.jumpIndex).toBe(20)

        await session.historyLog.jump(dawn)
        await settled(session)

        expect(session.currentAction?.index).toBe(20)
        expect(session.gameState.epoch).toBe(2)
    })

    it('The list follows what is shown, and the live table brings it all back', async () => {
        const { session } = await conquered()
        await session.historyLog.jump(roundDivider(session, 1))
        await settled(session)

        expect(session.historyLog.entries.filter(isHistoryGroup).at(-1)?.firstIndex).toBe(5)

        session.history.goToEnd()
        await settled(session)

        expect(groupAt(session, 10).lastIndex).toBe(12)
    })
})

describe('R-2.2 Replay', () => {
    it('R-3.13, R-3.14 A turn replays from before its first Action through its last, on the animators', async () => {
        const { session } = await conquered()
        const steps = watchSteps(session)

        await session.historyLog.replay(groupAt(session, 10), hold)
        await settled(session)

        expect(steps.map(({ index }) => index)).toEqual([10, 11, 12])
        expect(steps[0].fromCount).toBe(10)
        expect(steps[2].toCount).toBe(13)
    })

    it('R-4.11.1 A span ending in a System Action stops there, however the next Actions cascade', async () => {
        const { host, session } = await roundOver()
        const progress = groupAt(session, 17)
        expect(host.actions[18].type).toBe(ActionType.EndRound)
        expect([progress.kind, progress.lastIndex, progress.replays]).toEqual([
            'progress',
            18,
            true
        ])
        const steps = watchSteps(session)

        await session.historyLog.replay(progress, hold)
        await settled(session)

        expect(steps.map(({ index }) => index)).toEqual([17, 18])
    })

    it('R-4.12 A dawn replays all of itself and its round`s end, not the next round', async () => {
        const { session } = await dawned()
        const steps = watchSteps(session)

        await session.historyLog.replay(groupAt(session, 18), hold)
        await settled(session)

        expect(steps.map(({ index }) => index)).toEqual([18, 19, 20])
        expect(steps[0].fromCount).toBe(18)
        expect(steps[2].toCount).toBe(21)
    })

    it('It returns to the live table', async () => {
        const { host, session } = await conquered()

        await session.historyLog.replay(groupAt(session, 10), hold)
        await settled(session)

        expect(session.isViewingHistory).toBe(false)
        expect(session.historyLog.replaying).toBe(false)
        expect(session.actions).toHaveLength(host.actions.length)
    })

    it('It returns to the step it started on, if History View was open', async () => {
        const { session } = await conquered()
        await session.historyLog.jump(groupAt(session, 10))
        await settled(session)

        await session.historyLog.replay(groupAt(session, 10), hold)
        await settled(session)

        expect(session.isViewingHistory).toBe(true)
        expect(session.currentAction?.index).toBe(12)
    })

    it('An entry the contract doesn`t list doesn`t replay', async () => {
        const { session } = await conquered()
        const hands = groupAt(session, 7)
        expect(hands.replays).toBe(false)
        const steps = watchSteps(session)

        await session.historyLog.replay(hands, hold)
        await settled(session)

        expect(steps).toEqual([])
        expect(session.isViewingHistory).toBe(false)
    })

    it('Neither happens while the shared history refuses: the table is busy', async () => {
        const { session } = await conquered()
        vi.spyOn(session.history, 'isDisabled').mockReturnValue(true)
        const steps = watchSteps(session)

        expect(session.historyLog.available).toBe(false)
        await session.historyLog.replay(groupAt(session, 10), hold)
        await session.historyLog.jump(groupAt(session, 10))
        await settled(session)

        expect(steps).toEqual([])
        expect(session.historyLog.replaying).toBe(false)
        expect(session.isViewingHistory).toBe(false)
    })

    it('While it runs the list holds still and nothing else starts', async () => {
        const { session } = await conquered()
        const { historyLog: log } = session
        const before = log.entries.map(({ id }) => id)
        const turn = groupAt(session, 10)
        const during: { ids: string[]; available: boolean; entryId?: string }[] = []
        const steps = watchSteps(session, () => {
            during.push({
                ids: log.entries.map(({ id }) => id),
                available: log.available,
                entryId: log.replayingEntryId
            })
            void log.replay(turn, hold)
            void log.jump(turn)
        })

        await log.replay(turn, hold)
        await settled(session)

        expect(steps.map(({ index }) => index)).toEqual([10, 11, 12])
        expect(during).toHaveLength(3)
        for (const step of during) {
            expect(step).toEqual({ ids: before, available: false, entryId: turn.id })
        }
        expect(session.isViewingHistory).toBe(false)
    })

    it('A replay that fails still leaves the list thawed', async () => {
        const { session } = await conquered()
        vi.spyOn(session.history, 'replayRange').mockRejectedValue(new Error('refused'))

        await expect(session.historyLog.replay(groupAt(session, 10), hold)).rejects.toThrow(
            'refused'
        )

        expect(session.historyLog.replaying).toBe(false)
    })

    it('R-3.2 An Action arriving mid-replay leaves the live table showing it and the list thawed', async () => {
        const { host, seat, session } = await conquered()
        const next = host.order[(host.order.indexOf(seat) + 1) % host.order.length]
        expect(host.state.activePlayerIds).toEqual([next])

        const replay = session.historyLog.replay(groupAt(session, 10), { holdMs: 40 })
        await host.send(next, { type: ActionType.ForfeitCard, kind: 'tax' })
        await replay
        await settled(session)

        expect(session.historyLog.replaying).toBe(false)
        expect(session.isViewingHistory).toBe(false)
        expect(session.actions).toHaveLength(host.actions.length)
        expect(groupAt(session, 14).kind).toBe('turn')
    })
})

describe('R-X.1 Neither changes the game or sends anything', () => {
    it.each([
        {
            name: 'A jump',
            press: (session: FeudumGameSession) => session.historyLog.jump(groupAt(session, 10))
        },
        {
            name: 'A replay',
            press: (session: FeudumGameSession) =>
                session.historyLog.replay(groupAt(session, 10), hold)
        }
    ])('$name, seen from the host and the seat`s own table', async ({ press }) => {
        const { host, seat, session } = await conquered()
        const actions = [...host.actions]
        const state = structuredClone(host.state)
        const sent = new Map(host.sent)
        const live = JSON.stringify(session.gameState)
        const apply = vi.spyOn(session, 'applyAction')

        await press(session)
        await settled(session)
        session.history.goToEnd()
        await settled(session)

        expect(host.actions).toEqual(actions)
        expect(host.state).toEqual(state)
        expect(host.sent).toEqual(sent)
        expect(apply).not.toHaveBeenCalled()
        expect(JSON.stringify(session.gameState)).toBe(live)
        expect(session.myPlayerId).toBe(seat)
    })
})

/**
 * R-3.10.1, R-4.4.1, R-3.3 One turn that draws and keeps writs and then plays its second card: 10
 * Explore, 11 KeepWrits, 12 AdvanceTurn with the same seat, 13 Migrate, so it replays. Every seat and
 * a spectator are watching as it's played.
 */
async function writTurn() {
    let onto: SpaceId = 'space.desert.1'
    const table = hosted(
        await seatedAtCards(
            ['explore', 'migrate', 'tax'],
            (state, { seat }) => {
                onto = emptySpace(state, 'outpost')
                placeMarker(state, seat, onto)
                buildFeudum(state, seat, emptySpace(state, 'farm'))
                state.recomputeRanks()
                returnGoods(state, seat)
                addPawn(state, seat, 'knight', emptySpace(state, 'outpost'))
                giveGood(state, seat, 'food')
                giveGood(state, seat, 'food')
            },
            { pouchGood: 'sulfur', otherCards: ['tax', 'guild'] }
        )
    )
    const { host, seat, other, session } = table
    const thirdId = host.order.find((id) => id !== seat && id !== other)
    assertExists(thirdId, 'Three seats')
    const watchers = {
        other: await host.openSeat(other),
        third: await host.openSeat(thirdId),
        spectator: await host.openSpectator()
    }
    const everyone = [session, ...Object.values(watchers)]
    await host.send(seat, { type: ActionType.Explore, revealsInfo: true, secondCard: true })
    const drawn =
        new HydratedFeudumGameState(structuredClone(host.state)).flow.writDraw?.drawn ?? []
    expect(drawn.length).toBeGreaterThan(1)
    await host.send(seat, { type: ActionType.KeepWrits, keep: drawn.slice(0, 1) })
    const { pawns } = new HydratedFeudumGameState(structuredClone(host.state)).getPlayerState(seat)
    const free = pawns.find(({ spaceId }) => !spaceId)
    assertExists(free, 'A pawn is off the board')
    await host.send(seat, {
        type: ActionType.Migrate,
        pawn: free.n,
        onto: { character: 'monk', spaceId: onto }
    })
    for (const one of everyone) {
        await settled(one)
    }
    flushSync()
    return { ...table, ...watchers, drawn }
}

describe('R-5-H1 A replayed span shows no hidden fact to a seat that may not see it', () => {
    const Watchers = ['other', 'third', 'spectator'] as const

    it('R-3.3-H1 A real second card grows the one entry, across the AdvanceTurn it took', async () => {
        const { host, session, seat } = await writTurn()
        const turn = groupAt(session, 10)

        expect(host.actions[12]).toMatchObject({
            type: ActionType.AdvanceTurn,
            metadata: { outcome: 'second-card', turnPlayerId: seat }
        })
        expect(turn.actions.map(({ type }) => type)).toEqual([
            ActionType.Explore,
            ActionType.KeepWrits,
            ActionType.Migrate
        ])
        expect([turn.lastIndex, turn.jumpIndex, turn.replays, turn.playerId]).toEqual([
            13,
            13,
            true,
            seat
        ])
    })

    it('The drawing seat`s own replay does hold the writs, so the checks below can fail', async () => {
        const { session, drawn } = await writTurn()
        const steps = watchSteps(session)

        await session.historyLog.replay(groupAt(session, 10), hold)
        await settled(session)

        expect(steps.map(({ index }) => index)).toEqual([10, 11, 12, 13])
        expect(writsNamedIn(steps.map(({ shown }) => shown))).toEqual(
            expect.arrayContaining([...drawn])
        )
    })

    it.each(Watchers)('%s replays the same span with the writs nowhere in it', async (watcher) => {
        const table = await writTurn()
        const session = table[watcher]
        const steps = watchSteps(session)

        await session.historyLog.replay(groupAt(session, 10), hold)
        await settled(session)

        expect(steps.map(({ index }) => index)).toEqual([10, 11, 12, 13])
        const named = writsNamedIn(steps.map(({ shown }) => shown))
        for (const writId of table.drawn) {
            expect(named).not.toContain(writId)
        }
    })

    it.each(Watchers)(
        '%s jumps to the span`s end with the writs nowhere on the table',
        async (watcher) => {
            const table = await writTurn()
            const session = table[watcher]

            await session.historyLog.jump(groupAt(session, 10))
            await settled(session)

            expect(session.currentAction?.index).toBe(13)
            const named = writsNamedIn(session.gameState.dehydrate())
            for (const writId of table.drawn) {
                expect(named).not.toContain(writId)
            }
        }
    )

    it.each(Watchers)(
        '%s reads the entry through its own record, with no writ in a line',
        async (watcher) => {
            const table = await writTurn()
            const session = table[watcher]
            const turn = groupAt(session, 10)
            const lines = turn.actions.map((action) =>
                session.actionLine(action, session.historyLog.viewerId)
            )

            expect(lines).toHaveLength(3)
            expect(lines.every(Boolean)).toBe(true)
            expect(writsNamedIn(turn.actions)).toEqual([])
        }
    )

    it('R-3.14-H1 An answer`s replay never shows the hand it was answered from', async () => {
        const { other, seat, third } = await conquered()
        const hands: unknown[] = []
        const steps = watchSteps(third, ({ to }) => {
            hands.push(to.getPlayerState(other).hand, to.getPlayerState(seat).hand)
        })

        await third.historyLog.replay(groupAt(third, 10), hold)
        await settled(third)

        expect(steps.map(({ index }) => index)).toEqual([10, 11, 12])
        expect(hands).toEqual(Array(6).fill(undefined))
    })
})
