import { mount, tick, unmount } from 'svelte'
import { ActionSource, Color, assertExists, createAction } from '@tabletop/common'
import {
    LetPeek,
    LetPeekSubjectKind,
    MachineState,
    PlayerStatus,
    PowerQuestionKind,
    SearchPlay,
    SetupChoice,
    TOP_CRADLE_SLOT,
    type PowerQuestion
} from '@tabletop/oath'
import { openTurn, testPlayer, testState, testVaultWithRelics } from '@tabletop/oath/testing'
import GameTable from '$lib/components/GameTable.svelte'
import type { OathGameSession } from '$lib/model/session.svelte.js'
import {
    disposeSessions,
    openSessionOn,
    searchingTable,
    setupTable,
    tableOf,
    type PlayedTable
} from './sessionHarness.js'

export type TableName = 'setup' | 'searching' | 'prophets' | 'offTurn'

const PROPHET_ADVISERS = [
    'denizen.order.messenger',
    'denizen.order.longbows',
    'denizen.hearth.herald'
]

function prophet(visionCardId: string): PowerQuestion {
    return {
        kind: PowerQuestionKind.PlayOrDiscardVision,
        cardId: 'denizen.discord.false-prophet',
        askedPlayerId: 'me',
        visionCardId
    }
}

/** Visual contract scenario 16: two False Prophet questions for one player, at the adviser limit. */
function prophetsTable(): PlayedTable {
    const state = testState(
        [
            testPlayer({
                playerId: 'me',
                color: Color.Red,
                siteId: 'c1',
                advisers: PROPHET_ADVISERS.map((cardId) => ({ cardId, faceUp: false }))
            }),
            testPlayer({
                playerId: 'holder',
                color: Color.Purple,
                status: PlayerStatus.Chancellor,
                siteId: 'c2'
            })
        ],
        {
            machineState: MachineState.PowerQuestion,
            chancellorPlayerId: 'holder',
            pendingQuestions: {
                queue: [prophet('vision.conquest'), prophet('vision.faith')],
                askingPlayerId: 'holder',
                resumeMachineState: MachineState.ActPhase
            }
        }
    )
    state.activePlayerIds = ['me']
    state.vault = testVaultWithRelics({})
    return tableOf(state)
}

/** The let-peek coexistence rule off the clock: another seat's Act Phase, this seat holding a facedown adviser. */
function offTurnTable(): PlayedTable {
    const state = testState(
        [
            testPlayer({
                playerId: 'me',
                color: Color.Red,
                siteId: 'c1',
                advisers: [{ cardId: 'denizen.arcane.tutor', faceUp: false }]
            }),
            testPlayer({
                playerId: 'ann',
                color: Color.Purple,
                status: PlayerStatus.Chancellor,
                siteId: 'c1'
            })
        ],
        { machineState: MachineState.ActPhase, chancellorPlayerId: 'ann' }
    )
    openTurn(state, 'ann')
    state.activePlayerIds = ['ann']
    state.vault = testVaultWithRelics({})
    return tableOf(state)
}

const TABLES: Record<TableName, () => PlayedTable> = {
    setup: setupTable,
    searching: searchingTable,
    prophets: prophetsTable,
    offTurn: offTurnTable
}

let session: OathGameSession | undefined
let component: ReturnType<typeof mount> | undefined

function current(): OathGameSession {
    assertExists(session, 'A table is open')
    return session
}

async function settled(): Promise<void> {
    await tick()
    await current().waitForVisibleTransitionSettled()
    await new Promise(requestAnimationFrame)
}

export async function open(name: TableName): Promise<{ seatId: string | undefined }> {
    if (component) await unmount(component)
    disposeSessions()
    session = openSessionOn(TABLES[name]())
    const target = document.createElement('div')
    target.style.height = '100vh'
    document.body.replaceChildren(target)
    component = mount(GameTable, { target, props: { gameSession: session } })
    await settled()
    return { seatId: session.myPlayer?.id }
}

/** Another seat's Action arriving while this seat is mid-pick: a facedown adviser shown out of turn (R-9.4). */
export async function anotherSeatLetsPeek(): Promise<string> {
    const table = current()
    const seatId = table.myPlayer?.id
    const other = table.gameState.players.find(
        (player) => player.playerId !== seatId && player.advisers.some((row) => !row.faceUp)
    )
    assertExists(other, 'Another seat holds a facedown adviser')
    const adviserIds = other.adviserIds
    assertExists(adviserIds, 'A hotseat client holds every adviser')
    const cardId = adviserIds[other.advisers.findIndex((row) => !row.faceUp)]
    const toPlayerId = table.gameState.players.find(
        (player) => player.playerId !== other.playerId
    )?.playerId
    assertExists(toPlayerId, 'Someone can be shown it')
    await table.applyAction(
        createAction(LetPeek, {
            gameId: table.gameState.gameId,
            source: ActionSource.User,
            playerId: other.playerId,
            toPlayerId,
            subject: { kind: LetPeekSubjectKind.Adviser, cardId }
        })
    )
    await settled()
    return other.playerId
}

/** The Chancellor's setup choice at the top Cradle site, sent as its own client would send it (R-1.23). */
export async function seatMakesSetupChoice(): Promise<void> {
    const table = current()
    const seatId = table.myPlayer?.id
    assertExists(seatId, 'A seat is on the clock')
    const hand = table.gameState.getPlayerState(seatId).handIds
    assertExists(hand, 'The seat on the clock sees its hand')
    await table.applyAction(
        createAction(SetupChoice, {
            gameId: table.gameState.gameId,
            source: ActionSource.User,
            playerId: seatId,
            siteId: TOP_CRADLE_SLOT,
            adviserCardId: hand[0],
            discardOrder: hand.slice(1)
        })
    )
    await settled()
}

export function searchPicks(): { kept?: string; placement?: SearchPlay } {
    const search = current().search
    return { kept: search.kept, placement: search.placement?.play }
}

export function questionPicks(): { visionDiscard?: string; offered: string[]; queued: number } {
    const table = current()
    return {
        visionDiscard: table.question.visionDiscard,
        offered: table.question.visionDiscards,
        queued: table.gameState.pendingQuestions?.queue.length ?? 0
    }
}

export function viewOffTheClock(): string | undefined {
    const table = current()
    table.setViewingAsNonActivePlayer(true)
    return table.myPlayer?.id
}

export function letPeekState(): { open: boolean; staged: boolean; action?: string } {
    const table = current()
    return {
        open: table.letPeekOpen,
        staged: table.letPeekIsStaged,
        action: table.selection.action
    }
}
