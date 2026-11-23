import {
    addPawn,
    setBarn,
    setCarts,
    setMarket,
    setMaster,
    setPawns,
    showOnStacks
} from '@tabletop/feudum/testing'
import { flushSync, mount } from 'svelte'
import { assertExists, type Point } from '@tabletop/common'
import {
    ActionType,
    AlchemistCartSpaces,
    Goods,
    HydratedFeudumGameState,
    GuildIds,
    GuildTrackSpaces,
    MachineState,
    Spaces,
    migrateOffers,
    moveConcealedSeal,
    returnGoodToHaversack,
    ScrollSpaces,
    type SpaceId
} from '@tabletop/feudum'
import GameTable from '$lib/components/GameTable.svelte'
import { pawnTarget, roleOf, spaceTarget } from '$lib/model/boardOffer.js'
import type { FeudumGameSession } from '$lib/model/session.svelte.js'
import { isHistoryGroup } from '$lib/utils/actionAggregator.js'
import type { GuildSide } from '$lib/model/boardFocus.svelte.js'
import { playOutRound } from './roundEndTable.js'
import { settled, type FeudumHost } from './sessionHarness.js'
import { atPlayingCards, giveGood } from './turnTable.js'

export interface MotionFrame {
    readonly at: number
    readonly x?: number
    readonly y?: number
    readonly writes: string
    readonly updating: boolean
    readonly capInert: boolean
    readonly overlaysInert: boolean
    readonly tokens: readonly string[]
    readonly shownTokens: readonly string[]
    readonly scale: number
    readonly lit: number
}

function boardPointOf(element: Element | null): Point | undefined {
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
            shownTokens: [...document.querySelectorAll('[data-transient]')]
                .filter((token) => Number(getComputedStyle(token).opacity) > 0)
                .map((token) => token.getAttribute('data-token') ?? ''),
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
    const stray = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
    stray.setAttribute('style', 'position: fixed; width: 0; height: 0')
    document.body.prepend(stray)
    mount(GameTable, { target, props: { gameSession: session } })
    flushSync()
    return stray
}

/** Contract, Game log and history: the one entry of this kind, replayed through the log as a press would. */
function replayOf(session: FeudumGameSession, kind: 'turn' | 'dawn') {
    const group = session.historyLog.entries
        .filter(isHistoryGroup)
        .findLast((entry) => entry.kind === kind && entry.replays)
    assertExists(group, `A ${kind} entry replays`)
    return session.historyLog.replay(group)
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

/** S64 R-3.7.1, R-3.7.4 A Move and its pilfer, played: `replay` shows them again, watched. */
export async function openPilferTable() {
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
        giveGood(state, seat, 'iron')
        state.getPlayerState(seat).goods.iron -= 1
        state.spaces[RoadEnd].goods.iron += 1
        state.recomputeRanks()
    })
    const session = await host.openSeat(seat)
    await show(session)
    const piece = { kind: 'pawn', playerId: seat, n: 1 } as const
    await host.send(seat, {
        type: ActionType.Move,
        steps: [{ piece, to: RoadEnd, medium: 'road' }],
        pilfer: { piece, from: 'space', resource: 'iron' }
    })
    await settled(session)
    Object.assign(window, {
        feudumSession: session,
        motionTable: {
            replay: () => framesOf(session, `pawn:${seat}:1`, () => replayOf(session, 'turn')),
            tableText: () => document.querySelector('[data-game-ui]')?.textContent ?? ''
        }
    })
}

export interface PawnFrame {
    readonly at: number
    readonly x: number
    readonly y: number
    readonly drawn: 'piece' | 'copy'
}

function pawnPointOf(piece: string): Omit<PawnFrame, 'at'> | undefined {
    const svg = document.querySelector('[data-board-surface]')
    const matrix = svg instanceof SVGSVGElement ? svg.getScreenCTM()?.inverse() : undefined
    if (!matrix) {
        return undefined
    }
    const onBoard = svg?.querySelector(`[data-motion="${piece}"]`)
    const copy = [...document.querySelectorAll('[data-flight-row="pawns"]')].find(
        (element) => element instanceof HTMLElement && element.style.visibility === 'visible'
    )
    const drawn = copy ? 'copy' : onBoard ? 'piece' : undefined
    const element = copy?.querySelector('[data-flight-side]:not([hidden])') ?? onBoard
    if (!drawn || !element) {
        return undefined
    }
    const box = element.getBoundingClientRect()
    const point = new DOMPoint(box.x + box.width / 2, box.y + box.height / 2).matrixTransform(
        matrix
    )
    return { x: point.x, y: point.y, drawn }
}

/** S64 R-3.3-H1, R-3.7.1 A Migrate, then a Move on along the road, replayed frame by frame. */
export async function openMigrateMoveTable() {
    const { host, seat } = await atPlayingCards(['migrate', 'move'], { pouchGood: 'sulfur' })
    host.edit((state) => {
        for (const player of state.players) {
            for (const pawn of player.pawns) {
                delete pawn.spaceId
            }
        }
        giveGood(state, seat, 'food')
        state.recomputeRanks()
    })
    const offers = migrateOffers(new HydratedFeudumGameState(host.state), seat)
    assertExists(
        offers.spaces.find((spaceId) => spaceId === RoadStart),
        'R-3.6 The pawn may enter at the road'
    )
    const session = await host.openSeat(seat)
    await show(session)
    await host.send(seat, {
        type: ActionType.Migrate,
        pawn: offers.pawnsOff[0],
        onto: { character: 'knight', spaceId: RoadStart },
        secondCard: true
    })
    await host.send(seat, {
        type: ActionType.Move,
        steps: [
            {
                piece: { kind: 'pawn', playerId: seat, n: offers.pawnsOff[0] },
                to: RoadEnd,
                medium: 'road'
            }
        ]
    })
    await settled(session)
    const piece = `pawn:${seat}:${offers.pawnsOff[0]}`
    Object.assign(window, {
        feudumSession: session,
        motionTable: {
            replayPawn: async () => {
                const frames: PawnFrame[] = []
                const start = performance.now()
                let running = true
                const sample = () => {
                    if (!running) {
                        return
                    }
                    const point = pawnPointOf(piece)
                    if (point) {
                        frames.push({ at: performance.now() - start, ...point })
                    }
                    requestAnimationFrame(sample)
                }
                requestAnimationFrame(sample)
                await replayOf(session, 'turn')
                await settled(session)
                await new Promise(requestAnimationFrame)
                await new Promise(requestAnimationFrame)
                running = false
                return frames
            }
        }
    })
}

/** S64 R-4.12 A round played into epoch II, a seat master of a guild so the dawn scores it. */
export async function openDawnTable() {
    const { session, seat } = await playOutRound(2, (state, { seat: master }) => {
        setMaster(state, master, GuildIds[0])
        state.recomputeRanks()
    })
    await show(session)
    Object.assign(window, {
        feudumSession: session,
        motionTable: {
            seat: () => seat,
            replay: (piece: string) => framesOf(session, piece, () => replayOf(session, 'dawn')),
            tableText: () => document.querySelector('[data-game-ui]')?.textContent ?? ''
        }
    })
}

/** R-4.11, R-4.12 Every seat forfeits the last card, so the round's System Actions come, watched. */
export async function openRoundEndTable() {
    const { host, seat } = await atPlayingCards(['move'], { otherCards: ['move'] })
    host.edit((state) => {
        showOnStacks(state, [2, 2, 2, 2, 1, 1])
        state.epoch = 'track.epoch.i'
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

export interface PaintedPiece {
    readonly id: string
    readonly x: number
    readonly y: number
}

export interface PaintedFrame {
    readonly at: number
    readonly seen: readonly PaintedPiece[]
}

export interface WatchedReplay {
    readonly frames: readonly PaintedFrame[]
    readonly pieces: readonly PaintedPiece[]
}

function centreOf(element: Element): Omit<PaintedPiece, 'id'> {
    const box = element.getBoundingClientRect()
    return { x: box.x + box.width / 2, y: box.y + box.height / 2 }
}

function piecesPainted(prefix: string): PaintedPiece[] {
    const selector = `[data-motion^="${prefix}"]`
    const upright = [
        ...document.querySelectorAll(`[data-open-guild] [data-upright-area] ${selector}`)
    ]
    const shown = new Set(upright.map((piece) => piece.getAttribute('data-motion')))
    const drawn = [...document.querySelectorAll(selector)].filter(
        (piece) => !shown.has(piece.getAttribute('data-motion'))
    )
    return [...upright, ...drawn].map((piece) => ({
        id: piece.getAttribute('data-motion') ?? '',
        ...centreOf(piece)
    }))
}

function movingPainted(row: 'goods' | 'seals' | 'markers'): PaintedPiece[] {
    const tokens = [...document.querySelectorAll('[data-transient][data-token="good"]')]
        .filter((token) => row === 'goods' && Number(getComputedStyle(token).opacity) > 0)
        .map((token) => ({ id: token.getAttribute('data-transient') ?? '', ...centreOf(token) }))
    const copies = [...document.querySelectorAll(`[data-flight-row="${row}"]`)]
        .filter(
            (copy) =>
                copy instanceof HTMLElement &&
                copy.style.visibility === 'visible' &&
                Number(copy.style.opacity || '1') > 0
        )
        .map((copy) => ({
            id: copy.getAttribute('data-flight') ?? '',
            ...centreOf(
                copy.querySelector('[data-flight-side]:not([hidden]) svg') ??
                    copy.querySelector('[data-flight-side]:not([hidden])') ??
                    copy
            )
        }))
    return [...tokens, ...copies]
}

function frameOrigin(frame: string): Point {
    const box = document.querySelector(frame)?.getBoundingClientRect()
    return { x: box?.x ?? 0, y: box?.y ?? 0 }
}

function fromOrigin(pieces: readonly PaintedPiece[], origin: Point): PaintedPiece[] {
    return pieces.map((piece) => ({ ...piece, x: piece.x - origin.x, y: piece.y - origin.y }))
}

/** Contract, Animation plan: the seat's last turn again, through the log, watched frame by frame. */
async function watchTurn(
    session: FeudumGameSession,
    row: 'goods' | 'seals' | 'markers',
    pieces: string,
    frame = '[data-board-surface]'
): Promise<WatchedReplay> {
    const frames: PaintedFrame[] = []
    const start = performance.now()
    let running = true
    const sample = () => {
        if (running) {
            frames.push({
                at: performance.now() - start,
                seen: fromOrigin(movingPainted(row), frameOrigin(frame))
            })
            requestAnimationFrame(sample)
        }
    }
    requestAnimationFrame(sample)
    await replayOf(session, 'turn')
    await settled(session)
    await new Promise(requestAnimationFrame)
    await new Promise(requestAnimationFrame)
    running = false
    return { frames, pieces: fromOrigin(piecesPainted(pieces), frameOrigin(frame)) }
}

/** R-4.7 Each push or pull offers the seat a reeve; it keeps its discs. */
async function playDecliningReeves(
    host: FeudumHost,
    session: FeudumGameSession,
    seat: string,
    moves: readonly Parameters<FeudumHost['send']>[1][]
) {
    for (const move of moves) {
        await host.send(seat, move)
        await settled(session)
        if (session.gameState.machineState === MachineState.PlacingDisc) {
            await host.send(seat, { type: ActionType.PlaceDisc, place: false })
            await settled(session)
        }
    }
}

/** R-3.15, R-4.6.4, R-4.6.5 A Farmer push, then Repeat as the journeyman's Alchemist pull, replayed. */
export async function openGuildRepeatTable(side?: GuildSide) {
    const { host, seat, other } = await atPlayingCards(['guild', 'repeat'], {
        pouchGood: 'sulfur'
    })
    const good = 'saltpeter'
    host.edit((state) => {
        for (const player of state.players) {
            setPawns(state, player.playerId, [])
        }
        setPawns(state, seat, ['farmer', 'alchemist'])
        setPawns(state, other, ['alchemist', 'alchemist'])
        setBarn(state, { [good]: 1 })
        setMarket(state, {})
        setCarts(
            state,
            Object.fromEntries(
                Goods.map((one) => [
                    one,
                    AlchemistCartSpaces.filter((space) => space.good === one).length -
                        (one === good ? 2 : 0)
                ])
            )
        )
        state.recomputeRanks()
    })
    const session = await host.openSeat(seat)
    await show(session)
    await playDecliningReeves(host, session, seat, [
        {
            type: ActionType.GuildAction,
            guildId: 'farmer',
            fn: 'push',
            params: { goods: [good] },
            secondCard: true
        },
        {
            type: ActionType.GuildAction,
            guildId: 'alchemist',
            fn: 'pull',
            params: { goods: [good] },
            asRepeat: 'repeat'
        }
    ])
    if (side) {
        session.layers.toggleGuildSide(side)
        flushSync()
    }
    const carted = `good:${AlchemistCartSpaces.filter((space) => space.good === good).at(-2)?.id}`
    Object.assign(window, {
        feudumSession: session,
        motionTable: {
            replayTurn: () =>
                watchTurn(
                    session,
                    'goods',
                    carted,
                    side ? '[data-open-guild="alchemist"] [data-upright-area]' : undefined
                )
        }
    })
}

/** R-3.15, R-4.6.4 A Monk pull, then Repeat as its Farmer pull laying a bead on a chicken, replayed. */
export async function openBeadRepeatTable(side?: GuildSide) {
    const { host, seat } = await atPlayingCards(['guild', 'repeat'], {
        pouchGood: 'sulfur'
    })
    const [scroll] = ScrollSpaces
    host.edit((state) => {
        for (const player of state.players) {
            setPawns(state, player.playerId, [])
        }
        const [master, other] = host.order.filter((playerId) => playerId !== seat)
        setPawns(state, seat, ['monk', 'farmer'])
        setPawns(state, master, ['monk', 'monk'])
        setPawns(state, other, ['farmer', 'farmer'])
        const vault = state.requireVault()
        const { rosary } = state.guilds.monk
        for (const sealId of rosary.splice(1)) {
            vault.sealPile.push(sealId)
            state.supply.sealPileCount += 1
        }
        for (const { id } of ScrollSpaces) {
            if (state.guilds.noble.scrolls[id] !== (id === scroll.id)) {
                moveConcealedSeal(
                    state,
                    id === scroll.id ? { kind: 'pile' } : { kind: 'scroll', spaceId: id },
                    id === scroll.id ? { kind: 'scroll', spaceId: id } : { kind: 'pile' }
                )
            }
        }
        state.recomputeRanks()
    })
    const session = await host.openSeat(seat)
    await show(session)
    await playDecliningReeves(host, session, seat, [
        {
            type: ActionType.GuildAction,
            guildId: 'monk',
            fn: 'pull',
            params: { scrollSpaces: [scroll.id] },
            secondCard: true
        },
        {
            type: ActionType.GuildAction,
            guildId: 'farmer',
            fn: 'pull',
            params: {},
            asRepeat: 'repeat'
        }
    ])
    if (side) {
        session.layers.toggleGuildSide(side)
        flushSync()
    }
    Object.assign(window, {
        feudumSession: session,
        motionTable: {
            replayTurn: () =>
                watchTurn(
                    session,
                    'seals',
                    'bead:',
                    side ? '[data-open-guild="monk"] [data-upright-area]' : undefined
                )
        }
    })
}

/** R-3.15, R-4.5.3 Two Migrates, the second by Déjà Vu, taking the seat from journeyman to master. */
export async function openRankRepeatTable(side?: GuildSide) {
    const { host, seat, other } = await atPlayingCards(['migrate', 'repeat'], {
        pouchGood: 'sulfur'
    })
    host.edit((state) => {
        for (const player of state.players) {
            setPawns(state, player.playerId, [])
        }
        setPawns(state, other, ['farmer'])
        giveGood(state, seat, 'food')
        giveGood(state, seat, 'food')
        giveGood(state, seat, 'saltpeter')
        state.recomputeRanks()
    })
    const session = await host.openSeat(seat)
    await show(session)
    const migrate = async (repeat: boolean) => {
        const offers = migrateOffers(new HydratedFeudumGameState(host.state), seat)
        const [onto] = offers.spaces
        assertExists(onto, 'R-3.6 A pawn may enter')
        await host.send(seat, {
            type: ActionType.Migrate,
            pawn: offers.pawnsOff[0],
            onto: { character: 'farmer', spaceId: onto },
            ...(repeat ? { asRepeat: 'deja-vu' } : { secondCard: true })
        })
        await settled(session)
    }
    await migrate(false)
    const first = rankOf(host, seat)
    await migrate(true)
    const second = rankOf(host, seat)
    assertExists(first, 'R-4.5.3 One farmer brings the seat onto the track')
    assertExists(second, 'R-4.5.3 Two farmers keep it there')
    if (first === second) {
        throw new Error(`R-4.5.3 The second farmer moves the marker from ${first}`)
    }
    if (side) {
        session.layers.toggleGuildSide(side)
        flushSync()
    }
    Object.assign(window, {
        feudumSession: session,
        motionTable: {
            replayTurn: () =>
                watchTurn(
                    session,
                    'markers',
                    `rank:${second}`,
                    side ? '[data-open-guild="farmer"] [data-upright-area]' : undefined
                )
        }
    })
}

function rankOf(host: FeudumHost, playerId: string): string | undefined {
    const { tracks } = new HydratedFeudumGameState(host.state).guilds
    return GuildTrackSpaces.find(
        (space) => space.guild === 'farmer' && tracks.farmer[space.rank]?.playerId === playerId
    )?.id
}
