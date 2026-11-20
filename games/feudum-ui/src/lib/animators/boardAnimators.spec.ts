import { showLocation } from '@tabletop/feudum/testing'
import { flushSync } from 'svelte'
import { afterEach, beforeAll, describe, expect, it } from 'vitest'
import { AnimationContext } from '@tabletop/frontend-components'
import { ActionSource, assertExists, type GameAction, type Point } from '@tabletop/common'
import {
    ActionType,
    type BeginDawn,
    ChickenSpaces,
    FarmerBarn,
    Goods,
    GuildTrackSpaces,
    HydratedFeudumGameState,
    isAnswerAttack,
    isBeginDawn,
    isCommitAttack,
    isRollProgressDie,
    KnightMonsterIcons,
    knightRows,
    locationKindOf,
    MachineState,
    MarketSpaces,
    MonsterIds,
    type Move,
    returnGoodToHaversack,
    type RollProgressDie,
    Routes,
    ScrollSpaces,
    seatKnightRow,
    Spaces,
    type SealId,
    type TileId
} from '@tabletop/feudum'
import { askedToDefend, type AskTable } from '$lib/testing/askTable.js'
import { showOnStacks } from '$lib/testing/roundEndTable.js'
import { FeudumHost, settled } from '$lib/testing/sessionHarness.js'
import { addPawn, atPlayingCards, giveBead, giveSeal, giveTile } from '$lib/testing/turnTable.js'
import { spaceTarget } from '$lib/model/boardOffer.js'
import type { FeudumGameSession } from '$lib/model/session.svelte.js'
import { scoreDiscs, seatScores, type SeatScore } from '$lib/model/boardView.js'
import {
    GuildAreaWidth,
    GuildAreas,
    GuildBox,
    guildAreaAt,
    RoutePaths,
    knightCell,
    monsterIconMarker,
    routePointAt,
    scoreDiscAt,
    spaceGeometry
} from '$lib/utils/boardGeometry.js'
import { BoardAnimator, type MotionElement, type MotionSurface } from './boardAnimator.svelte.js'
import type { RestingCopy } from './flightAnimator.svelte.js'
import { planFlights } from './flightPlan.js'
import {
    planBoardMotion,
    planDirect,
    type BoardChange,
    type BoardMotion,
    type BoardPlan,
    type MotionTarget,
    type PlanRow
} from './boardPlan.js'
import { laneOfRow } from '$lib/model/knightLanes.js'

/** Contract, Fast fallback: stated here apart from the plan's own constant, which it checks. */
const ContractFastSeconds = 0.2

/** What the board's svg gives the animator, with everything written to it kept in order. */
class FakeElement implements MotionElement {
    readonly attributes = new Map<string, string>()
    readonly writes: string[] = []

    constructor(
        readonly selector: string,
        private readonly world: Point | undefined,
        private readonly surface: FakeSurface
    ) {}

    get parentElement() {
        const { world } = this
        return {
            getAttribute: () => (world ? `translate(${world.x} ${world.y})` : null)
        }
    }

    setAttribute(name: string, value: string) {
        this.attributes.set(name, value)
        this.writes.push(`${name}=${value}`)
        this.surface.log.push(this.selector)
        this.surface.onWrite()
    }

    removeAttribute(name: string) {
        this.attributes.delete(name)
    }

    get point(): Point {
        const found = this.attributes.get('transform')?.match(/translate\((-?[\d.]+) (-?[\d.]+)\)/)
        return found
            ? {
                  x: Number(found[1]) + (this.world?.x ?? 0),
                  y: Number(found[2]) + (this.world?.y ?? 0)
              }
            : (this.world ?? { x: 0, y: 0 })
    }

    get scaleX(): number {
        return Number(this.attributes.get('transform')?.match(/scale\((-?[\d.]+) /)?.[1] ?? 1)
    }

    get opacity(): number {
        return Number(this.attributes.get('opacity') ?? 1)
    }
}

class FakeSurface implements MotionSurface {
    readonly elements = new Map<string, FakeElement>()
    readonly log: string[] = []
    onWrite: () => void = () => {}

    constructor(private readonly worlds: ReadonlyMap<string, Point> = new Map()) {}

    querySelector(selector: string): FakeElement {
        const known = this.elements.get(selector)
        if (known) {
            return known
        }
        const key = selector.match(/data-motion="([^"]+)"/)?.[1] ?? ''
        const element = new FakeElement(selector, this.worlds.get(key), this)
        this.elements.set(selector, element)
        return element
    }

    of(target: MotionTarget): FakeElement {
        return this.querySelector(
            'token' in target
                ? `[data-transient="${target.token}"]`
                : target.part === 'rides'
                  ? `[data-motion="${target.piece}"] [data-rides]`
                  : `[data-motion="${target.piece}"]`
        )
    }

    piece(key: string): FakeElement {
        return this.querySelector(`[data-motion="${key}"]`)
    }
}

/** An open side's upright area: it holds only what it draws, and finds nothing else. */
class KnownSurface implements MotionSurface {
    readonly inner = new FakeSurface()

    constructor(private readonly known: readonly string[]) {}

    querySelector(selector: string): FakeElement | null {
        return this.known.includes(selector) ? this.inner.querySelector(selector) : null
    }
}

function hydrated(state: FeudumHost['state']) {
    return new HydratedFeudumGameState(structuredClone(state))
}

let host: FeudumHost | undefined

afterEach(() => {
    host?.close()
    host = undefined
})

/** R-1.4 The table with nothing on the map but what a spec stands there. */
async function emptyTable() {
    const table = await atPlayingCards(['move'], { otherCards: ['move'] })
    host = table.host
    table.host.edit((state) => {
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
    })
    return table
}

function freeRoute(state: HydratedFeudumGameState) {
    const held = new Set(Object.values(state.monsters).map(({ spaceId }) => spaceId))
    const route = Routes.find(
        ({ medium, a, b }) => medium === 'road' && !held.has(a) && !held.has(b)
    )
    if (!route) {
        throw new Error('A road is free')
    }
    return route
}

function changeFrom(
    table: { readonly host: FeudumHost },
    edit: (to: HydratedFeudumGameState) => void
): BoardChange {
    const from = hydrated(table.host.state)
    const to = hydrated(table.host.state)
    edit(to)
    return { from, to }
}

function anAction(playerId: string): GameAction {
    return {
        id: 'action',
        gameId: 'game',
        playerId,
        type: ActionType.ForfeitCard,
        source: ActionSource.User
    }
}

function moved(playerId: string, fields: Pick<Move, 'steps' | 'metadata'> & Partial<Move>): Move {
    return {
        id: 'action',
        gameId: 'game',
        source: ActionSource.User,
        type: ActionType.Move,
        playerId,
        ...fields
    }
}

interface Scene extends BoardChange {
    readonly action: GameAction
}

/** A pawn walks a road: from one end to the other, in the real states. */
interface WalkScene extends Scene {
    readonly action: Move
    readonly seat: string
    readonly route: (typeof Routes)[number]
}

async function walkScene(): Promise<WalkScene> {
    const table = await emptyTable()
    const { seat, host: game } = table
    const route = freeRoute(hydrated(game.state))
    game.edit((state) => addPawn(state, seat, 'knight', route.a))
    const n = hydrated(game.state)
        .getPlayerState(seat)
        .pawns.find((pawn) => pawn.spaceId)?.n
    if (n === undefined) {
        throw new Error('The pawn stands')
    }
    const change = changeFrom(table, (to) => {
        const pawn = to.getPlayerState(seat).pawns.find((one) => one.n === n)
        if (pawn) {
            pawn.spaceId = route.b
        }
    })
    return {
        ...change,
        seat,
        route,
        action: moved(seat, {
            steps: [{ piece: { kind: 'pawn', playerId: seat, n }, to: route.b, medium: 'road' }],
            metadata: { steps: [{ routeId: route.id, from: route.a }] }
        })
    }
}

/** What is left of a round: every seat forfeits, so the System Actions run, the seat's session open. */
async function roundEndScene(arrange?: (state: HydratedFeudumGameState, seat: string) => void) {
    const { host: game, seat, other } = await atPlayingCards(['move'], { otherCards: ['move'] })
    host = game
    game.edit((state) => {
        arrange?.(state, seat)
        showOnStacks(state, [2, 2, 2, 2, 1, 1])
        state.epoch = 'track.epoch.i'
    })
    const session = await game.openSeat(seat)
    await settled(session)
    return { game, seat, other, session }
}

interface Captured extends Scene {
    readonly kind: string
}

function listen(session: FeudumGameSession): Captured[] {
    const heard: Captured[] = []
    session.addGameStateChangeListener(async ({ from, to, action, kind }) => {
        if (from && action) {
            heard.push({ from, to, action, kind })
        }
    })
    return heard
}

async function forfeitAll(game: FeudumHost, session: FeudumGameSession) {
    while (hydrated(game.state).machineState === MachineState.PlayingCards) {
        const [asked] = hydrated(game.state).activePlayerIds
        const kind = hydrated(game.state).getPlayerState(asked).hand?.[0]
        await game.send(asked, { type: ActionType.ForfeitCard, kind })
        await settled(session)
    }
}

async function systemScenes() {
    const { game, session } = await roundEndScene()
    const heard = listen(session)
    await forfeitAll(game, session)
    const die = heard.find(({ action }) => isRollProgressDie(action))
    const dawn = heard.find(({ action }) => isBeginDawn(action))
    if (!die || !dawn) {
        throw new Error('The round ended in a die and a dawn')
    }
    return { heard, die, dawn }
}

const Scenes: Readonly<Record<PlanRow, () => Promise<Scene>>> = {
    pieces: walkScene,
    markers: async () => {
        const table = await emptyTable()
        const { seat, other } = table
        const { id } = Spaces[0]
        table.host.edit((state) => {
            state.spaces[id].ruler = { playerId: seat, subject: false }
            state.spaces[id].serf = { playerId: other }
        })
        return {
            ...changeFrom(table, (to) => {
                to.spaces[id].ruler = { playerId: other, subject: false }
                to.spaces[id].serf = { playerId: seat }
            }),
            action: anAction(seat)
        }
    },
    goods: async () => {
        const table = await emptyTable()
        const [market] = MarketSpaces
        table.host.edit((state) => {
            state.guilds.farmer.barn[market.good] = 2
            state.guilds.merchant.market[market.id] = false
        })
        return {
            ...changeFrom(table, (to) => {
                to.guilds.farmer.barn[market.good] = 1
                to.guilds.merchant.market[market.id] = true
            }),
            action: anAction(table.seat)
        }
    },
    tiles: async () => {
        const { die } = await systemScenes()
        return withRemovedTile(die)
    },
    discs: async () => {
        const table = await emptyTable()
        const { id } = Spaces[0]
        return {
            ...changeFrom(table, (to) => {
                showLocation(
                    to,
                    id,
                    locationKindOf(to.spaces[id].location) === 'farm' ? 'outpost' : 'farm'
                )
            }),
            action: anAction(table.seat)
        }
    },
    die: async () => (await systemScenes()).die,
    dawn: async () => (await systemScenes()).dawn,
    combat: async () => (await conquerAnswered(['defend', 'tax'], true)).heard,
    score: async () => {
        const table = await emptyTable()
        return {
            ...changeFrom(table, (to) => {
                to.getPlayerState(table.seat).score += 12
            }),
            action: anAction(table.seat)
        }
    }
}

function withRemovedTile(die: Scene): Scene {
    if (!isRollProgressDie(die.action)) {
        throw new Error('A die')
    }
    const action: RollProgressDie = {
        ...die.action,
        metadata: {
            faces: ['desert'],
            removed: { region: 'desert', tileId: 'tile.sea.i', landscape: 'orchard' }
        }
    }
    return { ...die, action }
}

/** R-3.14.1 The attack resolved by the answer, seen from the attacker's, asked and third seats. */
async function conquerAnswered(cards: Parameters<typeof askedToDefend>[0], flip: boolean) {
    const table: AskTable = await askedToDefend(cards)
    host = table.host
    const seats = [table.session, table.asked, table.third]
    const heardBy = seats.map((session) => listen(session))
    await table.host.send(table.other, {
        type: ActionType.AnswerAttack,
        flipDefend: flip,
        revealsInfo: true
    })
    for (const session of seats) {
        await settled(session)
    }
    const answers = heardBy.map((heard) => heard.find(({ action }) => isAnswerAttack(action)))
    const [heard] = answers
    if (!heard) {
        throw new Error('The answer was heard')
    }
    return { table, heard, answers }
}

/** A clock of frames through the whole timeline. */
function play(context: AnimationContext) {
    const timeline = context.actionTimeline
    timeline.pause()
    const duration = timeline.duration()
    for (let time = 0; time < duration; time += 0.02) {
        timeline.time(time)
    }
    timeline.progress(1)
}

async function animate(
    scene: BoardChange & { readonly action?: GameAction },
    {
        reduced = false,
        surface = new FakeSurface(),
        animator = new BoardAnimator(() => reduced)
    }: { reduced?: boolean; surface?: FakeSurface; animator?: BoardAnimator } = {}
) {
    if (!animator.tokens.length) {
        animator.attach(surface)
    }
    const context = new AnimationContext()
    await animator.onGameStateChange({ ...scene, animationContext: context })
    return { animator, surface, context, duration: context.actionTimeline.duration() }
}

function stepped(plan: BoardPlan): BoardPlan {
    const own = (target: MotionTarget): MotionTarget =>
        'token' in target ? { token: `1-${target.token}` } : target
    return {
        tokens: plan.tokens,
        motions: plan.motions.map((motion) => ({ ...motion, target: own(motion.target) }))
    }
}

function drawn(motion: BoardMotion): boolean {
    return (
        motion.path !== undefined ||
        motion.reveal === true ||
        motion.opacity !== undefined ||
        motion.scaleX !== undefined
    )
}

const RowNames = Object.keys(Scenes).filter((row): row is PlanRow => row in Scenes)

/** A copy resting on the flight layer, with what the board animator asked of it. */
class FakeResting implements RestingCopy {
    opacity = 1
    readonly moves: Point[] = []
    readonly fades: number[] = []

    moveTo(point: Point) {
        this.moves.push(point)
    }

    fadeTo(opacity: number) {
        this.opacity = opacity
        this.fades.push(opacity)
    }
}

describe('Contract, Replay: a piece an earlier Action brought on, not on the board yet', () => {
    it('R-3.7.1 its walk carries the resting copy, where a lookup of the piece finds nothing', async () => {
        const scene = await walkScene()
        const key = `pawn:${scene.seat}:1`
        const resting = new FakeResting()
        const carried = resting.moves
        const asked: string[] = []
        const animator = new BoardAnimator(
            () => false,
            (piece) => {
                asked.push(piece)
                return resting
            }
        )
        // As the board's svg does before the state shows the piece: nothing for its key.
        animator.attach(new KnownSurface([]))
        const context = new AnimationContext()
        await animator.onGameStateChange({ ...scene, animationContext: context })
        play(context)
        expect(asked).toContain(key)
        expect(carried.length).toBeGreaterThan(5)
        const end = carried.at(-1)
        const first = carried[0]
        expect(Math.hypot((end?.x ?? 0) - first.x, (end?.y ?? 0) - first.y)).toBeGreaterThan(5)
    })

    it('R-3.7.1 with reduced motion the copy is simply carried to where the walk ends', async () => {
        const scene = await walkScene()
        const resting = new FakeResting()
        const carried = resting.moves
        const animator = new BoardAnimator(
            () => true,
            () => resting
        )
        animator.attach(new KnownSurface([]))
        const context = new AnimationContext()
        await animator.onGameStateChange({ ...scene, animationContext: context })
        play(context)
        expect(carried).toHaveLength(1)
    })
})

describe('Contract, Replay: every kind a flight lands on the board rests as the piece the state will draw', () => {
    it('R-1.1 a good flown to a guild space rests as that space’s good', async () => {
        const scene = await Scenes.goods()
        const [market] = MarketSpaces
        const west = ['alchemist', 'merchant', 'farmer'] as const
        const [good] = planFlights({ ...scene, apart: west }).flights.filter(
            ({ row }) => row === 'goods'
        )
        expect(good.legs.at(-1)?.to).toMatchObject({ kind: 'board', rests: `good:${market.id}` })
    })

    it('R-4.3.4 a tile laid on a space rests as its landscape', async () => {
        const table = await emptyTable()
        const { id } = Spaces[0]
        let given: TileId | undefined
        table.host.edit((state) => {
            given = giveTile(state, table.seat)
        })
        const tileId = given
        assertExists(tileId, 'R-4.3.1 The seat holds a tile')
        const change = changeFrom(table, (to) => {
            const player = to.getPlayerState(table.seat)
            player.regionTiles = player.regionTiles.filter((one) => one !== tileId)
            to.spaces[id].landscape = { tileId, amount: 0 }
        })
        const [tile] = planFlights({ ...change, action: anAction(table.seat) }).flights.filter(
            ({ row }) => row === 'tiles'
        )
        expect(tile.legs.at(-1)?.to).toMatchObject({ kind: 'board', rests: `landscape:${id}` })
    })

    it('R-3.11.2 a bead laid on the board rests as its bead; a seal laid on a scroll as that scroll’s seal', async () => {
        const table = await emptyTable()
        const chicken = ChickenSpaces.find((space) => !space.setupBead)
        assertExists(chicken, 'R-1.4 A chicken space starts with no bead')
        const [scroll] = ScrollSpaces
        let held: SealId | undefined
        table.host.edit((state) => {
            giveBead(state, table.seat)
            giveSeal(state, table.seat)
            held = state.getPlayerState(table.seat).beads[0]
            state.guilds.noble.scrolls[scroll.id] = false
        })
        const sealId = held
        assertExists(sealId, 'R-3.11 The seat holds a bead')
        const change = changeFrom(table, (to) => {
            const player = to.getPlayerState(table.seat)
            player.beads = []
            to.guilds.farmer.chickens[chicken.id] = sealId
            player.sealCount -= 1
            to.guilds.noble.scrolls[scroll.id] = true
        })
        const ends = planFlights({ ...change, action: anAction(table.seat) })
            .flights.filter(({ row }) => row === 'seals')
            .map(({ legs }) => legs.at(-1)?.to)
        expect(ends).toContainEqual(expect.objectContaining({ rests: `bead:${sealId}` }))
        expect(ends).toContainEqual(expect.objectContaining({ rests: `seal:${scroll.id}` }))
    })

    it('R-1.1 a good an earlier Action flew on hides with the step that takes it on: its resting copy fades', async () => {
        const scene = await Scenes.goods()
        const resting = new FakeResting()
        const asked: string[] = []
        const animator = new BoardAnimator(
            () => false,
            (piece) => {
                asked.push(piece)
                return resting
            }
        )
        animator.attach(new KnownSurface([]))
        const context = new AnimationContext()
        await animator.onGameStateChange({ ...scene, animationContext: context })
        play(context)
        const [market] = MarketSpaces
        expect(asked).toContain(`good:${FarmerBarn.id}:${market.good}:1`)
        expect(resting.fades).toEqual([0])
    })

    it('R-1.1 a good an earlier step’s token left on a guild space is the token the next step takes on', async () => {
        const first = await Scenes.goods()
        const [market] = MarketSpaces
        const second = {
            from: first.to,
            to: (() => {
                const to = new HydratedFeudumGameState(structuredClone(first.to.dehydrate()))
                to.guilds.merchant.market[market.id] = false
                to.guilds.farmer.barn[market.good] += 1
                return to
            })(),
            action: first.action
        }
        const tokens = ['[data-transient="1-token-0"]', '[data-transient="2-token-0"]']
        const surface = new KnownSurface(tokens)
        const animator = new BoardAnimator(() => false)
        animator.attach(surface)
        for (const scene of [first, second]) {
            const context = new AnimationContext()
            await animator.onGameStateChange({ ...scene, animationContext: context })
            play(context)
        }
        const left = surface.inner.elements.get(tokens[0])
        const taken = surface.inner.elements.get(tokens[1])
        expect(left?.opacity).toBe(0)
        expect(taken?.opacity).toBe(1)
    })
})

describe('each row of the animation plan inside the board', () => {
    for (const row of RowNames) {
        it(`R-1.2 ${row}: plays as a tween with an Action, frame by frame`, async () => {
            const scene = await Scenes[row]()
            const plan = stepped(planBoardMotion(scene))
            const motions = plan.motions.filter(
                (motion) => motion.row === row && motion.duration > 0
            )
            expect(motions.length).toBeGreaterThan(0)
            const { surface, context } = await animate(scene)
            play(context)
            for (const { target } of motions) {
                expect(new Set(surface.of(target).writes).size).toBeGreaterThan(2)
            }
        })

        it(`R-1.2 ${row}: without an Action takes at most ${ContractFastSeconds} s, straight`, async () => {
            const scene = await Scenes[row]()
            const { duration } = await animate({ from: scene.from, to: scene.to })
            expect(duration).toBeLessThanOrEqual(ContractFastSeconds)
            const direct = planDirect(scene)
            for (const motion of direct.motions) {
                expect(motion.at).toBe(0)
                expect(motion.at + motion.duration).toBeLessThanOrEqual(ContractFastSeconds)
                expect(motion.path?.length ?? 2).toBe(2)
                expect(motion.pulse).toBeUndefined()
                expect(motion.turns).toBeUndefined()
            }
        })

        it(`S65 ${row}: under reduced motion follows each step with no tween, in order`, async () => {
            const scene = await Scenes[row]()
            const plan = stepped(planBoardMotion(scene))
            const shown = plan.motions.filter(drawn)
            const tweened = await animate(scene)
            play(tweened.context)
            const { surface, context } = await animate(scene, { reduced: true })
            const timeline = context.actionTimeline
            expect(
                timeline
                    .getChildren(false, true, true)
                    .every((one: { duration(): number }) => one.duration() === 0)
            ).toBe(true)
            expect(timeline.getChildren(false, true, true)).toHaveLength(shown.length)
            // Reduced motion holds the table for no time.
            expect(timeline.duration()).toBe(0)
            play(context)
            const landing = [...shown].sort((a, b) => a.at + a.duration - (b.at + b.duration))
            expect(firstWrites(surface.log)).toEqual(
                firstWrites(landing.map(({ target }) => surface.of(target).selector))
            )
            for (const { target } of shown) {
                const still = surface.of(target)
                const flowing = tweened.surface.of(target)
                expect(still.point).toEqual(flowing.point)
                expect(still.opacity).toBe(flowing.opacity)
                expect(still.scaleX).toBe(flowing.scaleX)
                expect(still.writes.length / 2).toBeLessThanOrEqual(
                    shown.filter((one) => sameTarget(one.target, target)).length
                )
            }
        })
    }
})

function sameTarget(a: MotionTarget, b: MotionTarget): boolean {
    return JSON.stringify(a) === JSON.stringify(b)
}

/** Each element once, where it first appears. */
function firstWrites(log: readonly string[]): readonly string[] {
    return [...new Set(log)]
}

describe('R-3.7.1 pawns and monsters on a Move', () => {
    it('R-3.7.1 step along the route line, not straight across, from slot to slot', async () => {
        const scene = await walkScene()
        const { motions } = planBoardMotion(scene)
        const [walk] = motions
        const key = motions.find(({ target }) => 'piece' in target)?.target
        expect(key).toMatchObject({ piece: expect.stringMatching(/^pawn:/) })
        const route = RoutePaths.get(scene.route.id)
        if (!route || !walk.path) {
            throw new Error('A route walked')
        }
        expect(walk.path[0]).toEqual(spaceGeometry(scene.route.a).pieceSlots[0])
        expect(walk.path.at(-1)).toEqual(spaceGeometry(scene.route.b).pieceSlots[0])
        const line = Array.from({ length: 100 }, (_, index) => routePointAt(route, index / 100))
        const onLine = walk.path
            .slice(1, -1)
            .every((point) => line.some(({ x, y }) => Math.hypot(point.x - x, point.y - y) < 12))
        expect(onLine).toBe(true)
        const { surface, context } = await animate(scene)
        play(context)
        if (!('piece' in walk.target)) {
            throw new Error('The piece walks')
        }
        expect(surface.piece(walk.target.piece).point).toEqual(walk.path.at(-1))
    })

    it('R-3.7.1 a world placement stays: the offset is from where the piece is drawn', async () => {
        const scene = await walkScene()
        const key = `pawn:${scene.seat}:1`
        const slot = spaceGeometry(scene.route.a).pieceSlots[0]
        const surface = new FakeSurface(new Map([[key, slot]]))
        const { context } = await animate(scene, { surface })
        play(context)
        const end = spaceGeometry(scene.route.b).pieceSlots[0]
        const element = surface.piece(key)
        expect(element.attributes.get('transform')).toContain(
            `translate(${Math.round((end.x - slot.x) * 100) / 100} ${Math.round((end.y - slot.y) * 100) / 100})`
        )
        expect(element.writes.every((write) => !write.includes('matrix'))).toBe(true)
    })

    it('R-3.7.1 the named pieces go one after another, and R-3.7.3 Godspeed after a pause', async () => {
        const table = await emptyTable()
        const { seat, host: game } = table
        const route = freeRoute(hydrated(game.state))
        game.edit((state) => {
            addPawn(state, seat, 'knight', route.a)
            addPawn(state, seat, 'noble', route.a)
        })
        const [first, second] = hydrated(game.state)
            .getPlayerState(seat)
            .pawns.filter((pawn) => pawn.spaceId)
        const scene = changeFrom(table, (to) => {
            for (const pawn of to.getPlayerState(seat).pawns) {
                if (pawn.spaceId) {
                    pawn.spaceId = route.b
                }
            }
        })
        const record = { routeId: route.id, from: route.a }
        const { motions } = planBoardMotion({
            ...scene,
            action: moved(seat, {
                steps: [
                    {
                        piece: { kind: 'pawn', playerId: seat, n: first.n },
                        to: route.b,
                        medium: 'road'
                    }
                ],
                godspeed: { pawn: second.n, to: route.b, medium: 'road' },
                metadata: { steps: [record], godspeed: record }
            })
        })
        const [walk, speed] = motions
        expect(speed.target).toEqual({ piece: `pawn:${seat}:${second.n}` })
        expect(speed.at).toBeGreaterThan(walk.at + walk.duration + 0.2)
    })

    it('R-4.2.2 a pawn on its vessel takes it along, and the one it steps off stays behind', async () => {
        const table = await emptyTable()
        const { seat, host: game } = table
        const route = freeRoute(hydrated(game.state))
        game.edit((state) => {
            addPawn(state, seat, 'knight', route.a)
            const pawn = state.getPlayerState(seat).pawns.find((one) => one.spaceId)
            if (pawn) {
                pawn.vessel = 'ship'
            }
        })
        const pawn = hydrated(game.state)
            .getPlayerState(seat)
            .pawns.find((one) => one.spaceId)
        if (!pawn) {
            throw new Error('A pawn')
        }
        const piece = { kind: 'pawn' as const, playerId: seat, n: pawn.n }
        const scene = changeFrom(table, (to) => {
            const walking = to.getPlayerState(seat).pawns.find((one) => one.n === pawn.n)
            if (walking) {
                walking.spaceId = route.b
            }
        })
        const step = { piece, to: route.b, medium: 'road' as const }
        const riding = planBoardMotion({
            ...scene,
            action: moved(seat, {
                steps: [step],
                metadata: { steps: [{ routeId: route.id, from: route.a, vessel: 'ship' }] }
            })
        })
        expect(riding.tokens).toEqual([])
        expect(riding.motions).toHaveLength(1)
        const leaving = planBoardMotion({
            ...scene,
            action: moved(seat, {
                steps: [step],
                metadata: { steps: [{ routeId: route.id, from: route.a, left: 'ship' }] }
            })
        })
        expect(leaving.tokens[0]).toMatchObject({
            face: { kind: 'vessel', vessel: 'ship' },
            place: spaceGeometry(route.a).vessels.ship,
            layer: 'under'
        })
        expect(leaving.motions[0]).toMatchObject({
            target: { piece: `pawn:${seat}:${pawn.n}`, part: 'rides' },
            opacity: 0
        })
        const boarding = planBoardMotion({
            ...scene,
            action: moved(seat, {
                steps: [{ ...step, vessel: 'board' }],
                metadata: { steps: [{ routeId: route.id, from: route.a, vessel: 'ship' }] }
            })
        })
        expect(boarding.tokens).toEqual([])
    })

    it('R-4.2.2 a vessel taken up rides as a token under the pawn; R-4.2.3 the ferry crosses and goes', async () => {
        const scene = await walkScene()
        const steps = scene.action.steps.map((step) => ({ ...step, ferry: true as const }))
        const record = { routeId: scene.route.id, from: scene.route.a, vessel: 'ship' as const }
        const { tokens, motions } = planBoardMotion({
            ...scene,
            action: moved(scene.seat, { steps, metadata: { steps: [record] } })
        })
        const kinds = tokens.map(({ face }) => face.kind)
        expect(kinds).toEqual(['vessel', 'ferry'])
        const ferry = motions.filter(
            ({ target }) => 'token' in target && target.token === tokens[1].id
        )
        expect(ferry.at(-1)?.opacity).toBe(0)
        const vessel = motions.find(
            ({ target, path }) => 'token' in target && target.token === tokens[0].id && path
        )
        const walk = motions.find(({ target }) => 'piece' in target && !('part' in target))
        expect(vessel?.path?.at(-1)?.y).toBeGreaterThan(walk?.path?.at(-1)?.y ?? Infinity)
    })

    it('R-4.2.4 a pinned pawn never moves, even when the slot beside it opens; a free one settles', async () => {
        const table = await emptyTable()
        const { host: game } = table
        const stateNow = hydrated(game.state)
        const [leaver, stayer] = stateNow.players.map(({ playerId }) => playerId)
        const [monster] = MonsterIds
        const way = freeRoute(stateNow)
        const { a: at, b: to } = way
        const scene = (controller: string | undefined) => {
            game.edit((state) => {
                for (const player of state.players) {
                    for (const pawn of player.pawns) {
                        delete pawn.spaceId
                    }
                }
                addPawn(state, leaver, 'knight', at)
                addPawn(state, stayer, 'knight', at)
                state.monsters[monster].spaceId = at
                state.monsters[monster].playerId = controller
                if (controller === undefined) {
                    delete state.monsters[monster].playerId
                }
            })
            const [pawn] = hydrated(game.state)
                .getPlayerState(leaver)
                .pawns.filter((one) => one.spaceId)
            const change = changeFrom(table, (next) => {
                const walking = next.getPlayerState(leaver).pawns.find((one) => one.n === pawn.n)
                if (walking) {
                    walking.spaceId = to
                }
            })
            return planBoardMotion({
                ...change,
                action: moved(leaver, {
                    steps: [
                        {
                            piece: { kind: 'pawn', playerId: leaver, n: pawn.n },
                            to,
                            medium: way.medium
                        }
                    ],
                    metadata: { steps: [{ routeId: way.id, from: at }] }
                })
            }).motions.map(({ target }) => target)
        }
        const [stayerPawn] = [`pawn:${stayer}:`]
        const stayerMoved = (targets: readonly MotionTarget[]) =>
            targets.some((target) => 'piece' in target && target.piece.startsWith(stayerPawn))
        expect(stayerMoved(scene(leaver))).toBe(false)
        expect(stayerMoved(scene(stayer))).toBe(true)
    })

    it('R-3.7.4 a pilfered good hops from its space onto the piece', async () => {
        const scene = await walkScene()
        const good = Goods[0]
        scene.from.spaces[scene.route.b].goods[good] = 1
        const { motions, tokens } = planBoardMotion({
            ...scene,
            action: moved(scene.seat, {
                steps: scene.action.steps,
                pilfer: { piece: scene.action.steps[0].piece, from: 'space', resource: good },
                metadata: {
                    steps: [{ routeId: scene.route.id, from: scene.route.a }],
                    pilfer: { spaceId: scene.route.b }
                }
            })
        })
        expect(tokens).toHaveLength(1)
        const hop = motions.find(({ row, duration }) => row === 'goods' && duration > 0)
        expect(hop?.path?.at(-1)).toEqual(spaceGeometry(scene.route.b).pieceSlots[0])
        expect(motions).toContainEqual(
            expect.objectContaining({
                target: { piece: `good:${scene.route.b}:${good}` },
                opacity: 0
            })
        )
    })
})

describe('R-4.1.2 markers inside the board', () => {
    it('R-4.1.2 a ruler and serf swap across the space', async () => {
        const scene = await Scenes.markers()
        const { motions } = planBoardMotion(scene)
        const geometry = spaceGeometry(Spaces[0].id)
        expect(motions.map(({ target, path }) => [target, path])).toEqual([
            [{ piece: `marker:${Spaces[0].id}:ruler` }, [geometry.ruler, geometry.serf]],
            [{ piece: `marker:${Spaces[0].id}:serf` }, [geometry.serf, geometry.ruler]]
        ])
    })

    it('R-4.5.2 a guild marker slides between its rank spaces, in the guild area, with its reeve', async () => {
        const table = await emptyTable()
        const [low, high] = GuildTrackSpaces
        table.host.edit((state) => {
            const track = state.guilds.tracks[low.guild]
            delete track.master
            delete track.journeyman
            delete track.apprentice
            track[low.rank] = { playerId: table.seat, reeve: true }
        })
        const { motions } = planBoardMotion({
            ...changeFrom(table, (to) => {
                const track = to.guilds.tracks[low.guild]
                delete track[low.rank]
                track[high.rank] = { playerId: table.seat, reeve: true }
            }),
            action: anAction(table.seat)
        })
        expect(motions.map(({ target }) => target)).toEqual([
            { piece: `rank:${low.id}` },
            { piece: `reeve:${low.id}` }
        ])
    })

    it('R-1.3 a Knight row fills one a beat after another; R-4.2.4 the top marker goes on to the icon', async () => {
        const table = await emptyTable()
        const scene = changeFrom(table, (to) => {
            knightRows(to)[0].row.markers += 2
        })
        const { rowId, row } = knightRows(scene.to)[0]
        const { motions, tokens } = planBoardMotion({ ...scene, action: anAction(table.seat) })
        expect(tokens.map(({ face }) => face.kind)).toEqual(['marker', 'marker'])
        expect(motions[1].at).toBeGreaterThan(motions[0].at)
        const area = GuildAreas.knight
        const scale = GuildAreaWidth / GuildBox.width
        const cell = knightCell(laneOfRow(scene.to, rowId), row.markers)
        expect(motions[1].path?.at(-1)).toEqual({
            x: area.x + cell.x * scale,
            y: area.y + cell.y * scale
        })
    })

    it('R-4.2.4 taking control, a row\u2019s top marker goes on to the monster\u2019s icon', async () => {
        const table = await emptyTable()
        const [icon] = KnightMonsterIcons
        table.host.edit((state) => {
            const row = seatKnightRow(state, table.seat)?.row
            if (row) {
                row.markers = 3
            }
        })
        const rowId = seatKnightRow(hydrated(table.host.state), table.seat)?.rowId
        const { motions } = planBoardMotion({
            ...changeFrom(table, (to) => {
                to.monsters[icon.monster] = { playerId: table.seat }
                const own = seatKnightRow(to, table.seat)?.row
                if (own) {
                    own.markers -= 1
                }
            }),
            action: anAction(table.seat)
        })
        expect(motions.map(({ target, path }) => [target, path?.at(-1)])).toEqual([
            [{ piece: `knight:${rowId}:3` }, monsterIconMarker(icon.id)]
        ])
    })

    it('Contract, Desk layout: in an open side the marker moves on the upright area’s own svg', async () => {
        const table = await emptyTable()
        const [icon] = KnightMonsterIcons
        table.host.edit((state) => {
            const row = seatKnightRow(state, table.seat)?.row
            if (row) {
                row.markers = 3
            }
        })
        const rowId = seatKnightRow(hydrated(table.host.state), table.seat)?.rowId
        const scene = {
            ...changeFrom(table, (to) => {
                to.monsters[icon.monster] = { playerId: table.seat }
                const own = seatKnightRow(to, table.seat)?.row
                if (own) {
                    own.markers -= 1
                }
            }),
            action: anAction(table.seat)
        }
        const marker = `[data-motion="knight:${rowId}:3"]`
        const board = new FakeSurface()
        const area = new KnownSurface([marker])
        const animator = new BoardAnimator(() => false)
        animator.attach(board)
        const open = animator.attachArea(area, 'knight')
        const { context } = await animate(scene, { animator, surface: board })
        play(context)
        expect(area.inner.elements.get(marker)?.writes.length).toBeGreaterThan(0)
        expect(board.elements.get(marker)).toBeUndefined()
        // Closed again, the motion is the board's, as on a phone's board.
        open.destroy()
        animator.settle()
        const again = await animate(scene, { animator, surface: board })
        play(again.context)
        expect(board.elements.get(marker)?.writes.length).toBeGreaterThan(0)
    })

    it('Contract, Desk layout: a side closed mid-motion drops its area’s pieces, and the tween writes to them no more', async () => {
        const table = await emptyTable()
        const [icon] = KnightMonsterIcons
        table.host.edit((state) => {
            const row = seatKnightRow(state, table.seat)?.row
            if (row) {
                row.markers = 3
            }
        })
        const scene = {
            ...changeFrom(table, (to) => {
                to.monsters[icon.monster] = { playerId: table.seat }
                const own = seatKnightRow(to, table.seat)?.row
                if (own) {
                    own.markers -= 1
                }
            }),
            action: anAction(table.seat)
        }
        const rowId = seatKnightRow(hydrated(table.host.state), table.seat)?.rowId
        const marker = `[data-motion="knight:${rowId}:3"]`
        const board = new FakeSurface()
        const area = new KnownSurface([marker])
        const animator = new BoardAnimator(() => false)
        animator.attach(board)
        const open = animator.attachArea(area, 'knight')
        const { context, duration } = await animate(scene, { animator, surface: board })
        const timeline = context.actionTimeline
        timeline.pause()
        timeline.time(duration / 2)
        const drawn = area.inner.elements.get(marker)
        const written = drawn?.writes.length ?? 0
        expect(written).toBeGreaterThan(0)
        open.destroy()
        timeline.progress(1)
        expect(drawn?.writes.length).toBe(written)
        // settle() no longer reaches the detached piece either.
        drawn?.attributes.set('transform', 'kept')
        animator.settle()
        expect(drawn?.attributes.get('transform')).toBe('kept')
    })

    it('S38 R-3.14.2 a crowned seal slides in under the serf', async () => {
        const table = await emptyTable()
        const { id } = Spaces[0]
        table.host.edit((state) => {
            state.spaces[id].serf = { playerId: table.other }
        })
        const { motions, tokens } = planBoardMotion({
            ...changeFrom(table, (to) => {
                to.spaces[id].serf = { playerId: table.other, immune: true }
            }),
            action: anAction(table.seat)
        })
        expect(tokens[0]).toMatchObject({ face: { kind: 'seal' }, layer: 'under' })
        const { serf } = spaceGeometry(id)
        expect(motions[0].path?.at(-1)?.x).toBe(serf.x)
        expect(motions[0].path?.[0].y).toBeGreaterThan(motions[0].path?.at(-1)?.y ?? Infinity)
    })
})

describe('R-1.1 goods between spaces and guild areas', () => {
    it('R-1.1 fly a short arc from the barn to the market, leaving the stack', async () => {
        const scene = await Scenes.goods()
        const { motions, tokens } = planBoardMotion(scene)
        expect(tokens.map(({ face }) => face.kind)).toEqual(['good'])
        const flight = motions.find(({ path }) => path)
        const [start, ...rest] = flight?.path ?? []
        const end = rest.at(-1)
        const middle = rest[Math.floor(rest.length / 2) - 1]
        if (!end || !middle) {
            throw new Error('A flight')
        }
        expect(middle.y).toBeLessThan((start.y + end.y) / 2 - 20)
        expect(motions).toContainEqual(
            expect.objectContaining({
                target: { piece: `good:${FarmerBarn.id}:${MarketSpaces[0].good}:1` },
                opacity: 0
            })
        )
    })

    it('Contract, Desk layout: with the West side open, the barn-to-market good is the flight layer’s, from one upright area to the other', async () => {
        const scene = await Scenes.goods()
        const west = ['alchemist', 'merchant', 'farmer'] as const
        const east = ['knight', 'noble', 'monk'] as const
        const { tokens, motions } = planBoardMotion({ ...scene, apart: west })
        expect(tokens).toEqual([])
        expect(motions.filter(({ row }) => row === 'goods')).toEqual([])
        const [market] = MarketSpaces
        const goods = planFlights({ ...scene, apart: west }).flights.filter(
            ({ row }) => row === 'goods'
        )
        expect(goods).toHaveLength(1)
        const [good] = goods
        expect(good.from).toMatchObject({
            kind: 'board',
            piece: `good:${FarmerBarn.id}:${market.good}:1`,
            hide: true
        })
        const landing = good.legs.at(-1)?.to
        expect(landing?.kind === 'board' ? guildAreaAt(landing.point) : undefined).toBe('merchant')
        // With the East open instead, the West's pair stays the board's.
        expect(planBoardMotion({ ...scene, apart: east }).tokens).toHaveLength(1)
        const eastGoods = planFlights({ ...scene, apart: east }).flights
        expect(eastGoods.filter(({ row }) => row === 'goods')).toEqual([])
    })

    it('R-1.1 go one after another, a few frames apart', async () => {
        const table = await emptyTable()
        const [first, second] = [Spaces[0].id, Spaces[1].id]
        const [good, next] = Goods
        table.host.edit((state) => {
            state.guilds.farmer.barn[good] = 2
            state.guilds.farmer.barn[next] = 2
        })
        const { motions } = planBoardMotion({
            ...changeFrom(table, (to) => {
                to.guilds.farmer.barn[good] = 1
                to.guilds.farmer.barn[next] = 1
                to.spaces[first].goods[good] = 1
                to.spaces[second].goods[next] = 1
            }),
            action: anAction(table.seat)
        })
        const flights = motions.filter(({ path }) => path)
        expect(flights).toHaveLength(2)
        const gap = flights[1].at - flights[0].at
        expect(gap).toBeGreaterThan(0)
        expect(gap).toBeLessThan(0.1)
    })

    it('R-1.1 a good that left for a seat has no pair: its flight is the seat panel layer’s', async () => {
        const table = await emptyTable()
        const [good] = Goods
        const space = Spaces[0].id
        table.host.edit((state) => {
            state.spaces[space].goods[good] = 1
        })
        const { motions, tokens } = planBoardMotion({
            ...changeFrom(table, (to) => {
                to.spaces[space].goods[good] = 0
            }),
            action: anAction(table.seat)
        })
        expect(tokens).toEqual([])
        expect(motions).toEqual([])
    })
})

describe('R-4.11.1 the die, the tile and R-4.12 the dawn', () => {
    it('R-4.11.1 the die tumbles for every face, a reroll again, and the stack named pulses', async () => {
        const { die } = await systemScenes()
        if (!isRollProgressDie(die.action)) {
            throw new Error('A die')
        }
        const action: RollProgressDie = {
            ...die.action,
            metadata: { faces: ['desert', 'forest'] }
        }
        const { motions, tokens } = planBoardMotion({ ...die, action })
        const tumbles = motions.filter(({ turns }) => turns === 1)
        expect(tumbles).toHaveLength(2)
        expect(tumbles[1].at).toBeGreaterThanOrEqual(tumbles[0].at + tumbles[0].duration)
        expect(tokens.map(({ face }) => face)).toEqual([
            { kind: 'die-face', region: 'desert' },
            { kind: 'die-face', region: 'forest' }
        ])
        const pulse = motions.find(({ pulse: swell }) => swell)
        expect(pulse?.target).toEqual({ piece: 'stack:forest' })
        expect(pulse?.at).toBeGreaterThanOrEqual(tumbles[1].at + tumbles[1].duration)
    })

    it('R-4.11-H2 the tile removed fades out of its stack', async () => {
        const scene = await Scenes.tiles()
        const { motions, tokens } = planBoardMotion(scene)
        const tile = tokens.find(({ face }) => face.kind === 'tile')
        expect(tile).toBeDefined()
        expect(
            motions
                .filter(
                    ({ target, row }) =>
                        row === 'tiles' && 'token' in target && target.token === tile?.id
                )
                .at(-1)?.opacity
        ).toBe(0)
    })

    it('R-4.12 the epoch marker goes to the next ray and glows, then each row in turn', async () => {
        const { dawn } = await systemScenes()
        if (!isBeginDawn(dawn.action)) {
            throw new Error('A dawn')
        }
        const action: BeginDawn = dawn.action
        const rows = action.metadata?.sheet ?? []
        expect(rows.length).toBeGreaterThan(1)
        const { from, to } = dawn
        expect(to.epoch).not.toBe(from.epoch)
        const { motions, tokens } = planBoardMotion({ from, to, action })
        const epoch = motions.find(({ target }) => sameTarget(target, { piece: 'epoch-marker' }))
        expect(epoch?.duration).toBeGreaterThan(0)
        expect(tokens.map(({ face }) => face.kind)).toContain('glow')
        const discs = motions.filter(
            ({ target }) => 'piece' in target && target.piece.startsWith('score:')
        )
        expect(discs.map(({ target }) => target)).toEqual(
            rows.map(({ playerId }) => ({ piece: `score:${playerId}` }))
        )
        for (let index = 1; index < discs.length; index += 1) {
            expect(discs[index].at).toBeGreaterThanOrEqual(
                discs[index - 1].at + discs[index - 1].duration
            )
        }
        expect(discs[0].at).toBeGreaterThanOrEqual((epoch?.at ?? 0) + (epoch?.duration ?? 0))
    })

    it('R-4.9.2 a disloyal seat slides back from what it gained, with a rose chip', async () => {
        const { dawn } = await systemScenes()
        if (!isBeginDawn(dawn.action) || !dawn.action.metadata) {
            throw new Error('A dawn')
        }
        const [row] = dawn.action.metadata.sheet
        const disloyal = { ...row, disloyaltyVp: -2, total: 3 }
        const action: BeginDawn = {
            ...dawn.action,
            metadata: { ...dawn.action.metadata, sheet: [disloyal] }
        }
        const { motions, tokens } = planBoardMotion({ ...dawn, action })
        expect(tokens.map(({ face }) => face)).toContainEqual({
            kind: 'chip',
            text: '-2',
            rose: true
        })
        const disc = motions.filter(({ target }) =>
            sameTarget(target, { piece: `score:${row.playerId}` })
        )
        const score = dawn.from.getPlayerState(row.playerId).score
        const restAt = (gained: number) =>
            restOf(
                seatScores(dawn.from).map((seat) =>
                    seat.playerId === row.playerId ? { ...seat, score: gained } : seat
                ),
                row.playerId
            )
        expect(disc[0].path?.at(0)).toEqual(restOf(seatScores(dawn.from), row.playerId))
        expect(disc[0].path?.at(-1)).toEqual(restAt(score + 5))
        expect(disc[1].path?.at(-1)).toEqual(restAt(score + 3))
        expect(disc[1].at).toBeGreaterThanOrEqual(disc[0].at + disc[0].duration)
    })

    it('R-1.2.5 a score walks the ring through the spaces between', async () => {
        const scene = await Scenes.score()
        const [walk] = planBoardMotion(scene).motions
        expect(walk.path).toHaveLength(13)
    })
})

describe('R-4.8.2 combat', () => {
    it('R-3.14.1 the flipped Defend turns up beside the defender', async () => {
        const { heard, table } = await conquerAnswered(['defend', 'tax'], true)
        const { motions, tokens } = planBoardMotion(heard)
        expect(tokens[0]).toMatchObject({
            face: { kind: 'defend', playerId: table.other },
            scaleX: 0
        })
        expect(motions[0]).toMatchObject({ reveal: true, scaleX: 1, row: 'combat' })
    })

    it('R-4.8.2 the tally chips rise, then the result, and they go', async () => {
        const { table } = await conquerAnswered(['defend', 'tax'], true)
        const heard = listen(table.session)
        await table.host.send(table.seat, {
            type: ActionType.CommitAttack,
            saltpeter: 0,
            weapons: [],
            revealsInfo: true
        })
        await settled(table.session)
        const commit = heard.find(({ action }) => isCommitAttack(action))
        if (!commit || !isCommitAttack(commit.action) || !commit.action.metadata) {
            throw new Error('The attack was committed')
        }
        const { attack, defence, attackerWins } = commit.action.metadata
        const { motions, tokens } = planBoardMotion(commit)
        expect(tokens.slice(0, 3).map(({ face }) => face)).toEqual([
            { kind: 'chip', text: `${attack.total}`, rose: false },
            { kind: 'chip', text: `${defence.total}`, rose: false },
            {
                kind: 'chip',
                text: attackerWins ? 'Conquered' : 'Held',
                rose: !attackerWins
            }
        ])
        const rising = motions.filter(({ row, path }) => row === 'combat' && path)
        expect(rising).toHaveLength(3)
        expect(rising[0].path?.[1].y).toBeLessThan(rising[0].path?.[0].y ?? 0)
        expect(rising[2].at).toBeGreaterThan(rising[0].at)
        const fades = motions.filter(({ row, opacity }) => row === 'combat' && opacity === 0)
        expect(fades).toHaveLength(3)
    })
})

describe('R-5-H1 no motion differs by what another seat holds', () => {
    it('R-5-H1 every seat of one Defend answer plans the same, holding the card or not', async () => {
        const { answers } = await conquerAnswered(['defend', 'tax'], true)
        const plans = answers.map((heard) => {
            if (!heard) {
                throw new Error('Every seat heard the answer')
            }
            return planBoardMotion(heard)
        })
        expect(plans[0].motions.length).toBeGreaterThan(0)
        expect(plans[1]).toEqual(plans[0])
        expect(plans[2]).toEqual(plans[0])
    })

    it('R-5-H1 no flip: a defender holding Defend and one who does not show the same motion', async () => {
        const held = await conquerAnswered(['defend', 'tax'], false)
        const heldPlans = held.answers.map((heard) => heard && planBoardMotion(heard))
        host?.close()
        const none = await conquerAnswered(['tax', 'guild'], false)
        const nonePlans = none.answers.map((heard) => heard && planBoardMotion(heard))
        expect(heldPlans[0]).toEqual(nonePlans[0])
        expect(heldPlans[2]).toEqual(nonePlans[2])
        expect(heldPlans[1]).toEqual(nonePlans[1])
    })

    it('R-5-H1 a Move plans the same whatever the seats hold, and reads no hand, pouch, writ or charter', async () => {
        const scene = await walkScene()
        const plain = planBoardMotion(scene)
        for (const state of [scene.from, scene.to]) {
            for (const player of state.players) {
                for (const field of ['hand', 'writs', 'sealedCharters', 'pouchGood']) {
                    Object.defineProperty(player, field, {
                        get() {
                            throw new Error(`The plan read ${field}`)
                        }
                    })
                }
            }
            Object.defineProperty(state, 'vault', {
                get() {
                    throw new Error('The plan read the vault')
                }
            })
        }
        expect(planBoardMotion(scene)).toEqual(plain)
        expect(planDirect(scene).motions).toEqual(planDirect(scene).motions)
    })
})

describe('System Actions after one user Action, and the gate', () => {
    beforeAll(() => {
        // The presenter plays them for real: a spec need not wait as long as a player.
        new AnimationContext().actionTimeline.parent?.timeScale(40)
    })

    it('R-4.11.1 R-4.12 they play in sequence, from where the last left off, gated all the while', async () => {
        const { game, session } = await roundEndScene()
        const surface = new FakeSurface()
        session.boardAnimator.attach(surface)
        const heard = listen(session)
        const shownBefore = session.gameState
        const gate: {
            readonly updating: boolean
            readonly shown: boolean
            readonly offered: number
        }[] = []
        surface.onWrite = () => {
            gate.push({
                updating: session.updatingVisibleState,
                shown: session.gameState === shownBefore,
                offered: session.boardOffer.targets.size
            })
        }
        await forfeitAll(game, session)
        expect(heard.some(({ action }) => isRollProgressDie(action))).toBe(true)
        expect(heard.some(({ action }) => isBeginDawn(action))).toBe(true)
        expect(gate.length).toBeGreaterThan(0)
        expect(gate.every(({ updating }) => updating)).toBe(true)
        expect(gate.every(({ offered }) => offered === 0)).toBe(true)
        const die = surface.log.indexOf('[data-motion="progress-die"]')
        const lastDie = surface.log.lastIndexOf('[data-motion="progress-die"]')
        const firstDisc = surface.log.findIndex((selector) => selector.includes('"score:'))
        expect(die).toBeGreaterThanOrEqual(0)
        expect(firstDisc).toBeGreaterThan(lastDie)
        expect(session.boardAnimator.tokens).toEqual([])
        for (const element of surface.elements.values()) {
            expect(element.attributes.size).toBe(0)
        }
    }, 30000)

    it('R-1.2.5 a later step takes the disc up where the last step left it, state unpublished', async () => {
        const table = await emptyTable()
        const { seat } = table
        const first = changeFrom(table, (to) => {
            to.getPlayerState(seat).score += 12
        })
        const animator = new BoardAnimator(() => false)
        const surface = new FakeSurface()
        const earlier = await animate({ ...first, action: anAction(seat) }, { animator, surface })
        play(earlier.context)
        const key = `score:${seat}`
        const left = surface.piece(key).point
        const firstEnd = walkEnd(first, seat)
        expect(left.x).toBeCloseTo(firstEnd.x, 1)
        expect(left.y).toBeCloseTo(firstEnd.y, 1)
        const further = changeFrom(table, (to) => {
            to.getPlayerState(seat).score += 17
        })
        const context = new AnimationContext()
        await animator.onGameStateChange({
            from: first.to,
            to: further.to,
            action: anAction(seat),
            animationContext: context
        })
        context.actionTimeline.pause()
        context.actionTimeline.time(0.001)
        const taken = surface.piece(key).point
        expect(Math.hypot(taken.x - left.x, taken.y - left.y)).toBeLessThan(2)
        context.actionTimeline.progress(1)
        const furtherEnd = walkEnd(further, seat)
        expect(surface.piece(key).point.x).toBeCloseTo(furtherEnd.x, 1)
        expect(surface.piece(key).point.y).toBeCloseTo(furtherEnd.y, 1)
    })

    it("R-3.2 the seat's own Move: the gate is shut from the first write, and the board offers nothing", async () => {
        const table = await emptyTable()
        const { host: game, seat } = table
        game.edit((state) => addPawn(state, seat, 'knight', 'space.desert.3'))
        const session = await game.openSeat(seat)
        await settled(session)
        const surface = new FakeSurface()
        session.boardAnimator.attach(surface)
        session.pressTurnCard('move')
        flushSync()
        await session.pressTurnTarget(spaceTarget('space.desert.1'))
        flushSync()
        let gated = false
        let offered = -1
        surface.onWrite = () => {
            if (offered < 0) {
                gated = session.updatingVisibleState
                offered = session.boardOffer.targets.size
            }
        }
        await session.sendTurnCard()
        await settled(session)
        expect(gated).toBe(true)
        expect(offered).toBe(0)
        expect(game.sent.get(seat)).toHaveLength(1)
        expect(session.updatingVisibleState).toBe(false)
    }, 30000)
})

function walkEnd({ to }: BoardChange, seat: string): Point {
    return restOf(seatScores(to), seat)
}

/** Where a seat's disc rests among these scores: fanned with any it shares a space with. */
function restOf(scores: readonly SeatScore[], seat: string): Point {
    const disc = scoreDiscs(scores).find(({ playerId }) => playerId === seat)
    if (!disc) {
        throw new Error('No such seat')
    }
    return scoreDiscAt(disc.space, disc.index, disc.count)
}

describe('R-1.2 history and interruption', () => {
    it('R-1.2 a state-only step plays only the interpolation, and no cinematic', async () => {
        const scene = await walkScene()
        const { motions } = planDirect(scene)
        expect(motions).toHaveLength(1)
        expect(motions[0].path).toHaveLength(2)
        expect(motions[0].row).toBe('pieces')
    })

    it('R-1.2 a publish in mid-tween leaves no piece part way, and a stale tween writes nothing', async () => {
        const scene = await walkScene()
        const { surface, context, animator } = await animate(scene)
        const timeline = context.actionTimeline
        timeline.pause()
        timeline.time(timeline.duration() / 2)
        const walking = [...surface.elements.values()].find(
            (element) => element.attributes.size > 0
        )
        expect(walking).toBeDefined()
        animator.settle()
        expect(walking?.attributes.size).toBe(0)
        const writes = walking?.writes.length
        timeline.progress(1)
        expect(walking?.attributes.size).toBe(0)
        expect(walking?.writes.length).toBe(writes)
    })

    it('R-1.2 no surface mounted, no motion and nothing to wait for', async () => {
        const scene = await walkScene()
        const context = new AnimationContext()
        await new BoardAnimator(() => false).onGameStateChange({
            ...scene,
            animationContext: context
        })
        expect(context.actionTimeline.duration()).toBe(0)
    })

    it('S65 under reduced motion a state-only step asks for nothing', async () => {
        const scene = await walkScene()
        const { duration } = await animate({ from: scene.from, to: scene.to }, { reduced: true })
        expect(duration).toBe(0)
    })
})
