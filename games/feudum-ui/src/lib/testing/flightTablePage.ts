import { flushSync, mount } from 'svelte'
import { AnimationContext } from '@tabletop/frontend-components'
import { ActionSource, type GameAction, type Point } from '@tabletop/common'
import {
    ActionType,
    HydratedFeudumGameState,
    RoyalWrits,
    placeMarker,
    type SpaceId
} from '@tabletop/feudum'
import GameTable from '$lib/components/GameTable.svelte'
import type { FeudumGameSession } from '$lib/model/session.svelte.js'
import { writName } from '$lib/model/writLabels.js'
import { seatedAtCards } from './followUpTable.js'
import { FeudumHost, settled } from './sessionHarness.js'
import { addPawn, buildFeudum, emptySpace, giveGood, returnGoods } from './turnTable.js'

export interface SeenCopy {
    readonly id: string
    readonly row: string
    readonly x: number
    readonly y: number
    readonly width: number
    readonly inDialog: boolean
    readonly html: string
}

export interface FlightFrame {
    readonly at: number
    readonly copies: readonly SeenCopy[]
    readonly hidden: readonly string[]
}

export interface Box {
    readonly x: number
    readonly y: number
    readonly left: number
    readonly right: number
    readonly top: number
    readonly bottom: number
}

function seenCopies(): SeenCopy[] {
    return [...document.querySelectorAll('[data-flight]')].flatMap((copy) => {
        const side = copy.querySelector('[data-flight-side]:not([hidden])')
        const box = side?.getBoundingClientRect()
        if (!box || getComputedStyle(copy).visibility === 'hidden') {
            return []
        }
        return [
            {
                id: copy.getAttribute('data-flight') ?? '',
                row: copy.getAttribute('data-flight-row') ?? '',
                x: box.x + box.width / 2,
                y: box.y + box.height / 2,
                width: box.width,
                inDialog: copy.closest('dialog:modal') !== null,
                html: copy.outerHTML
            }
        ]
    })
}

function hiddenByHand(): string[] {
    return [...document.querySelectorAll('[style*="visibility: hidden"]')]
        .filter((element) => !element.closest('[data-flight-layer]'))
        .map((element) =>
            element
                .getAttributeNames()
                .filter((name) => name.startsWith('data-'))
                .map((name) => `${name}="${element.getAttribute(name)}"`)
                .join(' ')
        )
}

function frameOf(start: number): FlightFrame {
    return { at: performance.now() - start, copies: seenCopies(), hidden: hiddenByHand() }
}

async function framesOf(
    until: () => Promise<unknown>,
    midway?: () => void
): Promise<FlightFrame[]> {
    const frames: FlightFrame[] = []
    const start = performance.now()
    let running = true
    let touched = false
    const sample = () => {
        if (!running) {
            return
        }
        const frame = frameOf(start)
        frames.push(frame)
        if (midway && !touched && frame.copies.length > 0 && frame.at > 150) {
            touched = true
            midway()
        }
        requestAnimationFrame(sample)
    }
    requestAnimationFrame(sample)
    await until()
    await new Promise(requestAnimationFrame)
    await new Promise(requestAnimationFrame)
    running = false
    return frames
}

function hydrated(session: FeudumGameSession): HydratedFeudumGameState {
    return new HydratedFeudumGameState(structuredClone(session.gameState.dehydrate()))
}

function boardEndOnScreen(session: FeudumGameSession): Point | undefined {
    const end = session.flightAnimator.flights[0]?.legs.at(-1)?.to
    const matrix = document.querySelector('[data-board-surface]')?.closest('svg')?.getScreenCTM()
    if (end?.kind !== 'board' || !matrix) {
        return undefined
    }
    const { x, y } = new DOMPoint(end.point.x, end.point.y).matrixTransform(matrix)
    return { x, y }
}

export async function openFlightTable(viewer: 'drawer' | 'other') {
    let pawnSpace: SpaceId | undefined
    const table = await seatedAtCards(['explore', 'tax'], (state, { seat }) => {
        placeMarker(state, seat, emptySpace(state, 'outpost'))
        buildFeudum(state, seat, emptySpace(state, 'farm'))
        state.recomputeRanks()
        returnGoods(state, seat)
        pawnSpace = emptySpace(state, 'outpost')
        addPawn(state, seat, 'knight', pawnSpace)
        giveGood(state, seat, 'food')
    })
    const { host, seat, other, session: drawer } = table
    const session = viewer === 'drawer' ? drawer : await host.openSeat(other)
    await settled(session)
    const target = document.createElement('div')
    target.dataset.gameUi = 'feudum'
    target.style.height = '100vh'
    document.body.replaceChildren(target)
    mount(GameTable, { target, props: { gameSession: session } })
    flushSync()

    const action: GameAction = {
        id: 'scene',
        gameId: 'game',
        playerId: seat,
        source: ActionSource.User,
        type: ActionType.ForfeitCard
    }

    const stage = async (edit: (to: HydratedFeudumGameState) => void, midway?: () => void) => {
        const from = hydrated(session)
        const to = hydrated(session)
        edit(to)
        const animationContext = new AnimationContext()
        const frames = await framesOf(async () => {
            await session.onGameStateChange({ from, to, action, animationContext })
            await animationContext.play()
        }, midway)
        const last = frameOf(performance.now())
        const boardEnd = boardEndOnScreen(session)
        session.beforeNewState({ kind: 'own-action', actions: [], intent: 'actions' })
        const hiddenAfter = hiddenByHand()
        flushSync()
        return { frames, last, boardEnd, hiddenAfter, copiesAfter: seenCopies().length }
    }

    const pawnHome = (to: HydratedFeudumGameState) => {
        for (const pawn of to.getPlayerState(seat).pawns) {
            if (pawn.spaceId === pawnSpace) {
                delete pawn.spaceId
            }
        }
    }
    const goodLeaves = (to: HydratedFeudumGameState) => {
        to.getPlayerState(seat).goods.food = 0
        to.supply.haversack.food += 1
    }

    const flightTable = {
        seat,
        other,
        boxOf(selector: string): Box | undefined {
            const box = document.querySelector(selector)?.getBoundingClientRect()
            return box
                ? {
                      x: box.x + box.width / 2,
                      y: box.y + box.height / 2,
                      left: box.left,
                      right: box.right,
                      top: box.top,
                      bottom: box.bottom
                  }
                : undefined
        },
        pieceOfPawn() {
            const pawn = session.gameState
                .getPlayerState(seat)
                .pawns.find(({ spaceId }) => spaceId === pawnSpace)
            return `pawn:${seat}:${pawn?.n}`
        },
        drawnWrits() {
            const { writsDrawn } = new HydratedFeudumGameState(
                structuredClone(host.state)
            ).getPlayerState(seat)
            return (writsDrawn ?? []).flatMap((writId) => [writId, writName(writId)])
        },
        pawnHome: () => stage(pawnHome),
        pawnHomeOpeningFullScreen: () =>
            stage(pawnHome, () => {
                document
                    .querySelector<HTMLElement>(
                        'button[aria-label*="full" i], button[title*="full" i]'
                    )
                    ?.click()
            }),
        goodLeaves: () => stage(goodLeaves),
        async holdPawnHome() {
            const from = hydrated(session)
            const to = hydrated(session)
            pawnHome(to)
            const animationContext = new AnimationContext()
            await session.onGameStateChange({ from, to, action, animationContext })
            const timeline = animationContext.actionTimeline
            timeline.pause()
            timeline.time(timeline.duration() * 0.6)
            return frameOf(performance.now())
        },
        async holdWritDraw() {
            const from = hydrated(session)
            const to = hydrated(session)
            to.flow.writDraw = {
                drawnCount: 3,
                keep: 1,
                source: 'explore',
                shovelsOffered: false
            }
            const animationContext = new AnimationContext()
            const drawnWritIds = RoyalWrits.slice(0, 3).map(({ id }) => id)
            await session.onGameStateChange({
                from,
                to,
                action: {
                    ...action,
                    type: ActionType.Explore,
                    ...(viewer === 'drawer' ? { metadata: { drawnWritIds } } : {})
                },
                animationContext
            })
            const timeline = animationContext.actionTimeline
            timeline.pause()
            timeline.time(timeline.duration() * 0.7)
            return frameOf(performance.now())
        },
        explore: () =>
            framesOf(async () => {
                await host.send(seat, { type: ActionType.Explore, revealsInfo: true })
                await settled(session)
            }),
        /** S66 The keep arrives while the draw is still in the air. */
        exploreThenKeep: () =>
            framesOf(async () => {
                const sent = host.send(seat, { type: ActionType.Explore, revealsInfo: true })
                await new Promise((done) => setTimeout(done, 120))
                const drawn =
                    new HydratedFeudumGameState(structuredClone(host.state)).getPlayerState(seat)
                        .writsDrawn ?? []
                await Promise.all([
                    sent,
                    host.send(seat, { type: ActionType.KeepWrits, keep: drawn.slice(0, 1) })
                ])
                await settled(session)
            }),
        latestShown: () =>
            JSON.stringify(
                session.gameState.dehydrate().players.map(({ writCount }) => writCount)
            ) === JSON.stringify(host.state.players.map(({ writCount }) => writCount)),
        hiddenByHand
    }
    Object.assign(window, { flightTable, feudumSession: session })
    return flightTable
}

/** R-1.4 A pawn just placed: a step back in history takes it off the board. */
export async function openHistoryTable() {
    const host = new FeudumHost()
    await host.playStartingGoods()
    await host.playStartingPawns(1)
    const seat = host.order.find((id) => id !== host.setupSeat) ?? host.setupSeat
    const session = await host.openSeat(seat)
    await settled(session)
    const target = document.createElement('div')
    target.dataset.gameUi = 'feudum'
    target.style.height = '100vh'
    document.body.replaceChildren(target)
    mount(GameTable, { target, props: { gameSession: session } })
    flushSync()
    const historyTable = {
        stepBack: () =>
            framesOf(async () => {
                await session.history.goToPreviousAction()
                await settled(session)
            })
    }
    Object.assign(window, { historyTable, feudumSession: session })
}

export type FlightTable = Awaited<ReturnType<typeof openFlightTable>>
