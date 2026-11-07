import { flushSync, mount } from 'svelte'
import {
    ActionType,
    Goods,
    MachineState,
    Spaces,
    returnGoodToHaversack,
    type SpaceId
} from '@tabletop/feudum'
import GameTable from '$lib/components/GameTable.svelte'
import { pawnTarget, roleOf, spaceTarget } from '$lib/model/boardOffer.js'
import type { FeudumGameSession } from '$lib/model/session.svelte.js'
import { showOnStacks } from './roundEndTable.js'
import { settled } from './sessionHarness.js'
import { addPawn, atPlayingCards } from './turnTable.js'

/** One frame of the page, as it was painted: a piece on the board's own coordinates, and the gate. */
export interface MotionFrame {
    readonly at: number
    readonly x?: number
    readonly y?: number
    readonly writes: string
    readonly updating: boolean
    readonly capInert: boolean
    readonly overlaysInert: boolean
    readonly tokens: readonly string[]
    readonly scale: number
    readonly lit: number
}

function boardPointOf(element: Element | null): { x: number; y: number } | undefined {
    const svg = element?.closest('svg')
    const matrix = svg?.getScreenCTM()?.inverse()
    if (!element || !svg || !matrix) {
        return undefined
    }
    const box = element.getBoundingClientRect()
    const point = new DOMPoint(box.x + box.width / 2, box.y + box.height / 2).matrixTransform(
        matrix
    )
    return { x: point.x, y: point.y }
}

/** Every animation frame until `until` settles: what a watcher would have seen, not what was planned. */
async function framesOf(
    session: FeudumGameSession,
    piece: string,
    until: () => Promise<unknown>
): Promise<MotionFrame[]> {
    const frames: MotionFrame[] = []
    const start = performance.now()
    let running = true
    const sample = () => {
        if (!running) {
            return
        }
        const element = document.querySelector(`[data-board-surface] [data-motion="${piece}"]`)
        const surface = document.querySelector('[data-board-surface]')
        frames.push({
            at: performance.now() - start,
            ...boardPointOf(element),
            writes: element?.getAttribute('transform') ?? '',
            updating: session.updatingVisibleState,
            capInert: document.querySelector('[data-action-cap]')?.hasAttribute('inert') ?? false,
            overlaysInert:
                document.querySelector('[data-motion-gate]')?.hasAttribute('inert') ?? false,
            tokens: [...document.querySelectorAll('[data-transient]')].map(
                (token) => token.getAttribute('data-token') ?? ''
            ),
            scale: surface?.getBoundingClientRect().width ?? 0,
            lit: document.querySelectorAll('[data-pick-role="lit"]').length
        })
        requestAnimationFrame(sample)
    }
    requestAnimationFrame(sample)
    await until()
    await settled(session)
    await new Promise(requestAnimationFrame)
    await new Promise(requestAnimationFrame)
    running = false
    return frames
}

async function show(session: FeudumGameSession) {
    await settled(session)
    const target = document.createElement('div')
    target.dataset.gameUi = 'feudum'
    target.style.height = '100vh'
    document.body.replaceChildren(target)
    // The same key outside the surface: the bench and the panel draw pieces of their own.
    const stray = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
    stray.setAttribute('style', 'position: fixed; width: 0; height: 0')
    document.body.prepend(stray)
    mount(GameTable, { target, props: { gameSession: session } })
    flushSync()
    return stray
}

const RoadStart: SpaceId = 'space.desert.3'
const RoadEnd: SpaceId = 'space.desert.1'

/** R-3.7.1 One pawn of the seat on a road, the Move card in hand: `walk` sends it, watched. */
export async function openWalkTable() {
    const { host, seat } = await atPlayingCards(['move'], { otherCards: ['move'] })
    host.edit((state) => {
        for (const player of state.players) {
            for (const pawn of player.pawns) {
                delete pawn.spaceId
            }
        }
        for (const { id } of Spaces) {
            const { goods } = state.spaces[id]
            for (const good of Goods) {
                returnGoodToHaversack(state, good, goods[good])
                goods[good] = 0
            }
        }
        addPawn(state, seat, 'knight', RoadStart)
        state.recomputeRanks()
    })
    const session = await host.openSeat(seat)
    const stray = await show(session)
    const piece = `pawn:${seat}:1`
    stray.innerHTML = `<g data-motion="${piece}"></g>`
    const pressed = async () => {
        session.pressTurnCard('move')
        flushSync()
        // A lone pawn is picked as the card is.
        if (roleOf(session.boardOffer, pawnTarget(seat, 1)) !== 'picked') {
            await session.pressTurnTarget(pawnTarget(seat, 1))
            flushSync()
        }
        await session.pressTurnTarget(spaceTarget(RoadEnd))
        flushSync()
        return session.movePanel?.primary?.label ?? ''
    }
    Object.assign(window, {
        feudumSession: session,
        motionTable: {
            pressed,
            walk: () => framesOf(session, piece, () => session.sendTurnCard()),
            tableText: () => document.querySelector('[data-game-ui]')?.textContent ?? '',
            logLine: () => {
                const moved = session.actions.findLast(({ type }) => type === ActionType.Move)
                return moved ? (session.actionLine(moved) ?? '') : ''
            },
            strayWrites: () => stray.firstElementChild?.getAttribute('transform') ?? ''
        }
    })
}

/** R-4.11, R-4.12 Every seat forfeits the last card, so the round's System Actions come, watched. */
export async function openRoundEndTable() {
    const { host, seat } = await atPlayingCards(['move'], { otherCards: ['move'] })
    host.edit((state) => {
        showOnStacks(state, [2, 2, 2, 2, 1, 1])
        state.epoch = 1
    })
    const session = await host.openSeat(seat)
    await show(session)
    const forfeitAll = async () => {
        while (session.gameState.machineState === MachineState.PlayingCards) {
            const [asked] = session.gameState.activePlayerIds
            let kind: string | undefined
            host.edit((state) => {
                kind = state.getPlayerState(asked).hand?.[0]
            })
            await host.send(asked, { type: ActionType.ForfeitCard, kind })
            await settled(session)
        }
    }
    Object.assign(window, {
        feudumSession: session,
        motionTable: {
            roundEnd: () => framesOf(session, 'progress-die', forfeitAll)
        }
    })
}
