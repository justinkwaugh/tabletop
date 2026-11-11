import { afterEach, beforeAll, describe, expect, it, vi, type MockInstance } from 'vitest'
import { AnimationContext } from '@tabletop/frontend-components'
import { ActionSource, type GameAction } from '@tabletop/common'
import {
    ActionType,
    Goods,
    HydratedFeudumGameState,
    RoyalWrits,
    Seals,
    Spaces,
    hiddenBeadCandidates,
    placeMarker,
    returnGoodToHaversack,
    type FeudumGameState,
    type SealId,
    type WritId
} from '@tabletop/feudum'
import { FeudumHost, settled } from '$lib/testing/sessionHarness.js'
import { holdWrit, seatedAtCards } from '$lib/testing/followUpTable.js'
import {
    addPawn,
    atPlayingCards,
    buildFeudum,
    emptySpace,
    returnGoods
} from '$lib/testing/turnTable.js'
import { FlightAnimator, type CopyElement, type CopySide } from './flightAnimator.svelte.js'
import type { FlightStage, HideableSource, StagePlace } from './flightAnchors.js'
import {
    planDirectFlights,
    planFlights,
    type Flight,
    type FlightChange,
    type FlightEnd,
    type FlightPlan
} from './flightPlan.js'
import { planBoardMotion } from './boardPlan.js'
import type { Point } from '$lib/utils/boardGeometry.js'
import flightPlanSource from './flightPlan.ts?raw'

/** Contract, Fast fallback: stated here apart from the plan's own constant, which it checks. */
const ContractFastSeconds = 0.2

let host: FeudumHost | undefined

afterEach(() => {
    host?.close()
    host = undefined
})

beforeAll(() => {
    // The presenter plays real timelines: a spec need not wait as long as a player.
    new AnimationContext().actionTimeline.parent?.timeScale(40)
})

function hydrated(state: FeudumGameState): HydratedFeudumGameState {
    return new HydratedFeudumGameState(structuredClone(state))
}

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

function changeFrom(
    table: { readonly host: FeudumHost },
    edit: (to: HydratedFeudumGameState) => void,
    action?: GameAction,
    viewerId?: string
): FlightChange {
    const from = hydrated(table.host.state)
    const to = hydrated(table.host.state)
    edit(to)
    return { from, to, action, viewerId }
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

/** An Action as a seat receives it, with whatever its projection left on it. */
function actionOf(
    playerId: string,
    type: ActionType,
    fields: Readonly<Record<string, unknown>> = {}
): GameAction {
    return { ...anAction(playerId), type, ...fields }
}

function rowOf(plan: FlightPlan, row: Flight['row']): readonly Flight[] {
    return plan.flights.filter((flight) => flight.row === row)
}

function endAt(flight: Flight): FlightEnd {
    return flight.legs[flight.legs.length - 1].to
}

/** All a piece does when a flight copies it: hide, and come back. */
class FakeSource implements HideableSource {
    everHidden = false
    readonly style: HideableSource['style'] & { visibility: string }

    constructor() {
        let shown = ''
        const note = (value: string) => {
            this.everHidden ||= value === 'hidden'
        }
        this.style = {
            get visibility() {
                return shown
            },
            set visibility(value: string) {
                shown = value
                note(value)
            },
            removeProperty() {
                shown = ''
                return ''
            }
        }
    }
}

class FakeSide implements CopySide {
    shown = true

    constructor(private readonly name: string) {}

    getAttribute(): string {
        return this.name
    }

    toggleAttribute(_name: string, hidden: boolean) {
        this.shown = !hidden
    }
}

class FakeCopy implements CopyElement {
    readonly style = { visibility: '', opacity: '', transform: '', filter: '' }
    readonly sides = [new FakeSide('first'), new FakeSide('then')]

    querySelectorAll() {
        return this.sides
    }

    get shownSides(): readonly string[] {
        return this.sides.filter(({ shown }) => shown).map((side) => side.getAttribute())
    }
}

/** Every end has its own place, and its own piece that can be seen to hide. */
class FakeStage implements FlightStage {
    readonly places = new Map<string, Point>()
    readonly sources = new Map<string, FakeSource>()
    zoom = 1

    private keyOf(end: FlightEnd): string {
        return JSON.stringify(end)
    }

    sourceOf(end: FlightEnd): FakeSource {
        const key = this.keyOf(end)
        const found = this.sources.get(key) ?? new FakeSource()
        this.sources.set(key, found)
        return found
    }

    locate(end: FlightEnd): StagePlace {
        const key = this.keyOf(end)
        const place = this.places.get(key) ?? {
            x: (this.places.size + 1) * 100,
            y: (this.places.size + 1) * 50
        }
        this.places.set(key, place)
        return {
            x: place.x * this.zoom,
            y: place.y * this.zoom,
            size: 20 * this.zoom,
            source: this.sourceOf(end)
        }
    }

    get hiddenSources(): readonly FakeSource[] {
        return [...this.sources.values()].filter(({ style }) => style.visibility === 'hidden')
    }

    get everHidden(): boolean {
        return [...this.sources.values()].some((source) => source.everHidden)
    }
}

function rig(reduced = false) {
    const stage = new FakeStage()
    const animator = new FlightAnimator(() => reduced)
    animator.useStage(stage)
    return { animator, stage }
}

async function played(animator: FlightAnimator, plan: FlightPlan) {
    const context = new AnimationContext()
    await animator.play(plan, context, 0)
    const copies = new Map(
        animator.flights.map(({ id }) => {
            const copy = new FakeCopy()
            animator.copy(id)(copy)
            return [id, copy]
        })
    )
    const timeline = context.actionTimeline
    timeline.pause()
    return { copies, timeline, duration: timeline.duration() }
}

function copyOf(copies: ReadonlyMap<string, FakeCopy>, id: string): FakeCopy {
    const copy = copies.get(id)
    if (!copy) {
        throw new Error(`Copy ${id} is drawn`)
    }
    return copy
}

function placeOf(copy: FakeCopy): Point {
    const found = copy.style.transform.match(/translate\((-?[\d.]+)px, (-?[\d.]+)px\)/)
    return found ? { x: Number(found[1]), y: Number(found[2]) } : { x: NaN, y: NaN }
}

describe('each row of the animation plan that crosses the wrapper', () => {
    it('S13 R-3.6 a pawn entering flies from its seat, and turns its face as it lands ', async () => {
        const table = await emptyTable()
        const { seat } = table
        const plan = planFlights(
            changeFrom(table, (to) => addPawn(to, seat, 'knight', 'space.desert.3'), anAction(seat))
        )
        const [pawn] = rowOf(plan, 'pawns')
        expect(pawn.from).toMatchObject({ kind: 'seat', playerId: seat, part: { part: 'pawns' } })
        expect(endAt(pawn)).toMatchObject({ kind: 'board' })
        expect(pawn.legs[0].turnTo).toMatchObject({ kind: 'pawn', character: 'knight' })
    })

    it('S14 S36 R-3.6 a pawn off the board flies home: its piece hides, a rose flash only if it lost', async () => {
        const table = await emptyTable()
        const { seat, host: game } = table
        game.edit((state) => addPawn(state, seat, 'knight', 'space.desert.3'))
        const leave = (to: HydratedFeudumGameState) => {
            for (const pawn of to.getPlayerState(seat).pawns) {
                delete pawn.spaceId
            }
        }
        const lost = planFlights(changeFrom(table, leave, anAction(seat)))
        const [home] = rowOf(lost, 'pawns')
        expect(home.from).toMatchObject({ kind: 'board', hide: true })
        expect(home.from).toHaveProperty('piece', expect.stringMatching(/^pawn:/))
        expect(endAt(home)).toMatchObject({ kind: 'seat', playerId: seat })
        expect(home.flash).toBeDefined()
        expect(home.legs[0].at).toBeGreaterThan(0)
        const migrate = actionOf(seat, ActionType.Migrate)
        const [gone] = rowOf(planFlights(changeFrom(table, leave, migrate)), 'pawns')
        expect(gone.flash).toBeUndefined()
    })

    it('R-4.1.2 a marker lands from its seat and one returned flies home; a swap of roles is the board’s (S37)', async () => {
        const table = await emptyTable()
        const { seat, other, host: game } = table
        const { id } = Spaces[0]
        const landing = planFlights(
            changeFrom(
                table,
                (to) => {
                    to.spaces[id].ruler = { playerId: seat, subject: false }
                },
                anAction(seat)
            )
        )
        expect(rowOf(landing, 'markers')).toHaveLength(1)
        expect(rowOf(landing, 'markers')[0].from).toMatchObject({ kind: 'seat', playerId: seat })
        game.edit((state) => {
            state.spaces[id].ruler = { playerId: seat, subject: false }
            state.spaces[id].serf = { playerId: other }
        })
        const swapped = planFlights(
            changeFrom(
                table,
                (to) => {
                    to.spaces[id].ruler = { playerId: other, subject: false }
                    to.spaces[id].serf = { playerId: seat }
                },
                anAction(seat)
            )
        )
        expect(rowOf(swapped, 'markers')).toEqual([])
        const removed = planFlights(
            changeFrom(
                table,
                (to) => {
                    delete to.spaces[id].serf
                },
                anAction(seat)
            )
        )
        const [home] = rowOf(removed, 'markers')
        expect(home.from).toMatchObject({ piece: `marker:${id}:serf`, hide: true })
        expect(endAt(home)).toMatchObject({ kind: 'seat', playerId: other })
    })

    it('S44 R-1.3 markers leaving a Knight row fly home; the one onto the icon and those filling a row are the board’s', async () => {
        const table = await emptyTable()
        const { seat, host: game } = table
        game.edit((state) => {
            const [row] = state.guilds.knight.rows
            row.playerId = seat
            row.markers = 3
        })
        const colour = hydrated(game.state).guilds.knight.rows[0].colour
        const left = planFlights(
            changeFrom(
                table,
                (to) => {
                    to.guilds.knight.rows[0].markers = 0
                },
                anAction(seat)
            )
        )
        expect(rowOf(left, 'markers').map(({ from }) => 'piece' in from && from.piece)).toEqual([
            `knight:${colour}:1`,
            `knight:${colour}:2`,
            `knight:${colour}:3`
        ])
        const filled = planFlights(
            changeFrom(
                table,
                (to) => {
                    to.guilds.knight.rows[0].markers = 5
                },
                anAction(seat)
            )
        )
        expect(rowOf(filled, 'markers')).toEqual([])
    })

    it('S20 R-3.11.2 goods cross one after another; what the board flies itself is not drawn twice', async () => {
        const table = await emptyTable()
        const { seat } = table
        const { id } = Spaces[0]
        const change = changeFrom(
            table,
            (to) => {
                to.supply.haversack.food -= 7
                to.spaces[id].goods.food += 5
                to.getPlayerState(seat).goods.food += 2
            },
            anAction(seat)
        )
        const goods = rowOf(planFlights(change), 'goods')
        expect(goods).toHaveLength(2)
        expect(goods.map(({ face }) => face)).toEqual([
            { kind: 'good', good: 'food' },
            { kind: 'good', good: 'food' }
        ])
        expect(goods.every((flight) => endAt(flight).kind === 'seat')).toBe(true)
        expect(goods[1].legs[0].at).toBeGreaterThan(goods[0].legs[0].at)
    })

    it('R-4.10.2 sulfur for the barrel lands in the barrel (S1)', async () => {
        const table = await emptyTable()
        const { seat } = table
        const goods = rowOf(
            planFlights(
                changeFrom(
                    table,
                    (to) => {
                        to.supply.haversack.sulfur -= 1
                        to.getPlayerState(seat).barrel += 1
                    },
                    anAction(seat)
                )
            ),
            'goods'
        )
        expect(goods).toHaveLength(1)
        expect(endAt(goods[0])).toMatchObject({ kind: 'seat', part: { part: 'barrel' } })
    })

    it('R-3.3 the pouch’s good flies once it is public, and only then: a draft reaches no plan', async () => {
        const table = await emptyTable()
        const { seat, host: game } = table
        game.edit((state) => {
            state.getPlayerState(seat).goods.sulfur = 1
        })
        const goods = rowOf(
            planFlights(
                changeFrom(
                    table,
                    (to) => {
                        const player = to.getPlayerState(seat)
                        player.goods.sulfur = 0
                        player.pouch = 'sulfur'
                    },
                    anAction(seat)
                )
            ),
            'goods'
        )
        expect(goods).toHaveLength(1)
        expect(goods[0].from).toMatchObject({
            kind: 'seat',
            part: { part: 'good', good: 'sulfur' }
        })
        expect(endAt(goods[0])).toMatchObject({ kind: 'seat', part: { part: 'pouch' } })
        expect(flightPlanSource).not.toMatch(/hand\.draft/i)
    })

    it('R-4.6.2 coin goes to the members in the payment’s order, then the charity', async () => {
        const table = await emptyTable()
        const { seat, other, host: game } = table
        const payer = game.order.find((id) => id !== seat && id !== other) ?? seat
        game.edit((state) => {
            state.getPlayerState(payer).shillings = 10
        })
        const coins = rowOf(
            planFlights(
                changeFrom(
                    table,
                    (to) => {
                        to.getPlayerState(payer).shillings = 7
                        to.getPlayerState(other).shillings += 1
                        to.getPlayerState(seat).shillings += 1
                        to.guilds.farmer.purse += 1
                    },
                    actionOf(payer, ActionType.GuildAction, {
                        metadata: {
                            payment: {
                                members: [
                                    { playerId: seat, amount: 1 },
                                    { playerId: other, amount: 1 }
                                ]
                            }
                        }
                    })
                )
            ),
            'shillings'
        )
        expect(coins.map(({ from }) => 'playerId' in from && from.playerId)).toEqual([
            payer,
            payer,
            payer
        ])
        expect(
            coins
                .map(endAt)
                .map((end) => ('playerId' in end ? end.playerId : 'piece' in end && end.piece))
        ).toEqual([seat, other, 'purse'])
    })

    it('R-4.3 a tile flies from its stack to the seat, turning to its landscape (S15)', async () => {
        const table = await emptyTable()
        const { seat, host: game } = table
        const state = hydrated(game.state)
        const region = 'desert'
        const tileId = state.regionStacks[region][0]
        const [tile] = rowOf(
            planFlights(
                changeFrom(
                    table,
                    (to) => {
                        to.regionStacks[region].shift()
                        to.getPlayerState(seat).regionTiles.push(tileId)
                    },
                    anAction(seat)
                )
            ),
            'tiles'
        )
        expect(tile.from).toMatchObject({ kind: 'board', piece: `stack:${region}`, hide: false })
        expect(tile.face).toMatchObject({ kind: 'tile', faceShown: false })
        expect(tile.legs[0].turnTo).toMatchObject({ kind: 'tile', faceShown: true })
        expect(endAt(tile)).toMatchObject({ kind: 'seat', part: { part: 'tile', tileId } })
    })

    it('R-4.3 a landscape flips to its back as it lands on a space; a spent tile fades (S17)', async () => {
        const table = await emptyTable()
        const { seat, host: game } = table
        const tileId = hydrated(game.state).regionStacks.desert[0]
        const { id } = Spaces[0]
        game.edit((state) => {
            state.regionStacks.desert.shift()
            state.getPlayerState(seat).regionTiles.push(tileId)
        })
        const [lands] = rowOf(
            planFlights(
                changeFrom(
                    table,
                    (to) => {
                        to.getPlayerState(seat).regionTiles = []
                        to.spaces[id].landscape = { tileId, amount: 3 }
                    },
                    anAction(seat)
                )
            ),
            'tiles'
        )
        expect(lands.face).toMatchObject({ faceShown: true })
        expect(lands.legs[0].turnTo).toMatchObject({ faceShown: false })
        expect(lands.legs[0].turnTo).not.toHaveProperty('landscape')
        const [spent] = rowOf(
            planFlights(
                changeFrom(
                    table,
                    (to) => {
                        to.getPlayerState(seat).regionTiles = []
                        to.tilesOutOfGame.push(tileId)
                    },
                    anAction(seat)
                )
            ),
            'tiles'
        )
        expect(spent.legs[0].fade).toBe(true)
    })

    it('R-5-H1 a seal flips where it lies, then moves as a bead (S46); a bead back turns to its seal side (S20)', async () => {
        const table = await emptyTable()
        const { seat, host: game } = table
        const sealId: SealId = Seals[0].id
        const flipped = rowOf(
            planFlights(
                changeFrom(
                    table,
                    (to) => {
                        to.supply.sealPileCount -= 1
                        to.getPlayerState(seat).beads.push(sealId)
                    },
                    anAction(seat)
                )
            ),
            'seals'
        )
        expect(flipped[0].face).toEqual({ kind: 'seal' })
        expect(flipped[0].legs[0].turnTo).toMatchObject({ kind: 'bead' })
        expect(endAt(flipped[0])).toMatchObject({ kind: 'seat', part: { part: 'bead' } })
        game.edit((state) => {
            state.getPlayerState(seat).beads.push(sealId)
        })
        const back = rowOf(
            planFlights(
                changeFrom(
                    table,
                    (to) => {
                        const player = to.getPlayerState(seat)
                        player.beads = []
                        player.sealCount += 1
                    },
                    anAction(seat)
                )
            ),
            'seals'
        )
        expect(back[0].face).toMatchObject({ kind: 'bead' })
        expect(back[0].legs[0].turnTo).toEqual({ kind: 'seal' })
        expect(endAt(back[0])).toMatchObject({ kind: 'seat', part: { part: 'seals' } })
    })

    it('R-3.14.2 a seal taken back flies from under its marker to the seat (S39); one going under is the board’s', async () => {
        const table = await emptyTable()
        const { seat, host: game } = table
        const { id } = Spaces[0]
        game.edit((state) => {
            state.spaces[id].serf = { playerId: seat, immune: true }
        })
        const [back] = rowOf(
            planFlights(
                changeFrom(
                    table,
                    (to) => {
                        to.spaces[id].serf = { playerId: seat }
                        to.getPlayerState(seat).sealCount += 1
                    },
                    anAction(seat)
                )
            ),
            'seals'
        )
        expect(back.face).toEqual({ kind: 'seal' })
        expect(back.from).toMatchObject({ kind: 'board' })
        expect(endAt(back)).toMatchObject({ kind: 'seat', playerId: seat })
        game.edit((state) => {
            state.spaces[id].serf = { playerId: seat }
            state.getPlayerState(seat).sealCount = 1
        })
        const under = planFlights(
            changeFrom(
                table,
                (to) => {
                    to.spaces[id].serf = { playerId: seat, immune: true }
                    to.getPlayerState(seat).sealCount = 0
                },
                anAction(seat)
            )
        )
        expect(rowOf(under, 'seals')).toEqual([])
    })

    it('R-3.2 rows run in the scenarios’ order: pawn then marker (S2), tile then goods (S17), goods then the unfed pawn (S53)', async () => {
        const table = await emptyTable()
        const { seat, host: game } = table
        const tileId = hydrated(game.state).regionStacks.desert[0]
        const { id } = Spaces[0]
        game.edit((state) => {
            addPawn(state, seat, 'farmer', 'space.desert.1')
            state.getPlayerState(seat).goods.food = 1
        })
        const plan = planFlights(
            changeFrom(
                table,
                (to) => {
                    const player = to.getPlayerState(seat)
                    const standing = player.pawns.find(({ spaceId }) => spaceId)
                    addPawn(to, seat, 'knight', 'space.desert.3')
                    if (standing) {
                        delete standing.spaceId
                    }
                    to.spaces[id].ruler = { playerId: seat, subject: false }
                    to.regionStacks.desert.shift()
                    player.regionTiles.push(tileId)
                    player.goods.food = 0
                    to.supply.haversack.food += 1
                },
                anAction(seat)
            )
        )
        const first = (row: Flight['row'], which = 0) => {
            const flight = rowOf(plan, row)[which]
            return flight.flash?.at ?? flight.legs[0].at
        }
        expect(first('pawns')).toBe(0)
        expect(first('markers')).toBeGreaterThan(first('pawns'))
        expect(first('tiles')).toBeGreaterThan(first('markers'))
        expect(first('goods')).toBeGreaterThan(first('tiles'))
        const home = rowOf(plan, 'pawns').find(({ flash }) => flash)
        expect(home?.flash?.at).toBeGreaterThan(first('goods'))
    })

    it('R-3.2 the score waits for what crosses the wrapper (S15, S36); without copies nothing changes', async () => {
        const table = await emptyTable()
        const { seat } = table
        const change = changeFrom(
            table,
            (to) => {
                to.getPlayerState(seat).score += 3
            },
            anAction(seat)
        )
        const action = anAction(seat)
        const alone = planBoardMotion({ from: change.from, to: change.to, action })
        const roomed = planBoardMotion({
            from: change.from,
            to: change.to,
            action,
            flightRoom: 1.5
        })
        const scoreAt = (plan: typeof alone) =>
            plan.motions.find(({ row }) => row === 'score')?.at ?? NaN
        expect(scoreAt(roomed) - scoreAt(alone)).toBeCloseTo(1.5)
        expect(roomed.flightsAt).toBe(alone.flightsAt)
    })
})

/** R-3.10.1 A real Explore, as each seat's client hears it: state and Action projected for that seat. */
async function realExplore() {
    const table = await seatedAtCards(['explore', 'tax'], (state, { seat }) => {
        placeMarker(state, seat, emptySpace(state, 'outpost'))
        buildFeudum(state, seat, emptySpace(state, 'farm'))
        state.recomputeRanks()
        returnGoods(state, seat)
    })
    host = table.host
    const { seat, other, session } = table
    const otherSession = await table.host.openSeat(other)
    for (const one of [session, otherSession]) {
        one.flightAnimator.useStage(new FakeStage())
    }
    const drawer = vi.spyOn(session.flightAnimator, 'plan')
    const onlooker = vi.spyOn(otherSession.flightAnimator, 'plan')
    const before = table.host.state
    await table.host.send(seat, { type: ActionType.Explore, revealsInfo: true })
    await settled(session)
    await settled(otherSession)
    const drawn = hydrated(table.host.state).flow.writDraw?.drawn ?? []
    return { ...table, otherSession, before, drawer, onlooker, drawn }
}

function writsIn(plan: FlightPlan) {
    return rowOf(plan, 'writs')
}

function noFaces(plan: FlightPlan) {
    return plan.flights.map(({ face, legs, ...rest }) => ({
        ...rest,
        face: face.kind === 'writ' ? 'writ' : face,
        legs: legs.map(({ turnTo: _turnTo, ...leg }) => leg)
    }))
}

function planOf(spy: MockInstance<FlightAnimator['plan']>): FlightPlan {
    const plan = spy.mock.results.at(-1)?.value
    if (!plan) {
        throw new Error('The session planned its flights')
    }
    return plan
}

describe('R-5.3 what a flying copy shows, seat by seat', () => {
    it('R-3.10.1 R-5.3 a drawn writ flies face up to its drawer alone (S50 row): the plan of another seat holds no id', async () => {
        const { drawer, onlooker, drawn, seat, other } = await realExplore()
        expect(drawn.length).toBeGreaterThan(0)
        // Each session plans as its own seat, whoever sent the Action.
        expect(drawer.mock.lastCall?.[0].viewerId).toBe(seat)
        expect(onlooker.mock.lastCall?.[0].viewerId).toBe(other)
        const mine = writsIn(planOf(drawer))
        expect(mine.map(({ face }) => face)).toEqual(
            drawn.map((writId) => ({ kind: 'writ', faceShown: true, writId }))
        )
        const theirs = writsIn(planOf(onlooker))
        expect(theirs).toHaveLength(mine.length)
        expect(theirs.every(({ face }) => face.kind === 'writ' && !face.faceShown)).toBe(true)
        const text = JSON.stringify(theirs)
        for (const writId of drawn) {
            expect(text).not.toContain(writId)
        }
        expect(noFaces(planOf(drawer))).toEqual(noFaces(planOf(onlooker)))
    })

    it('R-5.3 a spectator’s projection names no writ, and its plan draws only backs', async () => {
        const table = await seatedAtCards(['explore', 'tax'], (state, { seat }) => {
            placeMarker(state, seat, emptySpace(state, 'outpost'))
            buildFeudum(state, seat, emptySpace(state, 'farm'))
            state.recomputeRanks()
            returnGoods(state, seat)
        })
        host = table.host
        const { seat } = table
        const { currentState: fromState } = table.host.projected({ kind: 'spectator' })
        await table.host.send(seat, { type: ActionType.Explore, revealsInfo: true })
        const { currentState: toState, actions } = table.host.projected({
            kind: 'spectator'
        })
        const action = actions.at(-1)
        expect(JSON.stringify(action)).not.toContain('"writ.')
        const plan = planFlights({
            from: new HydratedFeudumGameState(fromState),
            to: new HydratedFeudumGameState(toState),
            action
        })
        const writs = writsIn(plan)
        expect(writs.length).toBeGreaterThan(0)
        expect(writs.every(({ face }) => face.kind === 'writ' && !face.faceShown)).toBe(true)
    })

    it('R-5.3 even an Action holding every field draws a back for another seat, or no seat at all', async () => {
        const table = await emptyTable()
        const { seat, other } = table
        const writId: WritId = RoyalWrits[0].id
        const change = changeFrom(table, (to) => {
            to.flow.writDraw = {
                playerId: seat,
                drawnCount: 1,
                keep: 1,
                source: 'explore',
                shovelsOffered: false,
                drawn: []
            }
        })
        const action = actionOf(seat, ActionType.Explore, {
            metadata: { drawnCount: 1, keep: 1, drawnWritIds: [writId] }
        })
        expect(writsIn(planFlights({ ...change, action, viewerId: seat }))[0].face).toEqual({
            kind: 'writ',
            faceShown: true,
            writId
        })
        for (const viewerId of [other, undefined]) {
            const [flight] = writsIn(planFlights({ ...change, action, viewerId }))
            expect(flight.face).toEqual({ kind: 'writ', faceShown: false })
            expect(JSON.stringify(flight)).not.toContain(writId)
        }
    })

    it('R-4.4.1 R-4.4-H3 a keep: kept writs show their faces to the keeper alone, the rest go under as backs for all', async () => {
        const table = await emptyTable()
        const { seat, other } = table
        const keep: readonly WritId[] = [RoyalWrits[0].id]
        const under: WritId = RoyalWrits[1].id
        const change = changeFrom(table, (to) => {
            to.getPlayerState(seat).writCount += 1
        })
        const action = actionOf(seat, ActionType.KeepWrits, {
            keep,
            metadata: { keptCount: 1, returnedCount: 2, returned: [{ writId: under, slot: 0 }] }
        })
        const mine = writsIn(planFlights({ ...change, action, viewerId: seat }))
        expect(mine[0].face).toEqual({ kind: 'writ', faceShown: true, writId: keep[0] })
        expect(mine[0].from).toMatchObject({ kind: 'offer', writId: keep[0], hide: true })
        expect(mine.slice(1).map(({ face }) => face)).toEqual([
            { kind: 'writ', faceShown: false },
            { kind: 'writ', faceShown: false }
        ])
        const theirs = writsIn(planFlights({ ...change, action, viewerId: other }))
        expect(theirs.map(({ face }) => face)).toEqual([
            { kind: 'writ', faceShown: false },
            { kind: 'writ', faceShown: false },
            { kind: 'writ', faceShown: false }
        ])
        expect(JSON.stringify(theirs)).not.toContain(keep[0])
        expect(JSON.stringify(mine)).not.toContain(under)
        expect(
            noFaces(planFlights({ ...change, action, viewerId: seat })).map(({ legs }) => legs)
        ).toEqual(
            noFaces(planFlights({ ...change, action, viewerId: other })).map(({ legs }) => legs)
        )
    })

    it('R-4.4.2 R-5.3 a played writ is public: face up over the table for every seat, then under (S50)', async () => {
        const table = await emptyTable()
        const { seat, other } = table
        const writId: WritId = RoyalWrits[0].id
        const change = changeFrom(table, (to) => {
            to.getPlayerState(seat).writCount -= 1
        })
        const action = actionOf(seat, ActionType.PlayMandate, { writId })
        for (const viewerId of [seat, other, undefined]) {
            const writs = writsIn(planFlights({ ...change, action, viewerId }))
            expect(writs).toHaveLength(1)
            expect(writs[0].face).toEqual({ kind: 'writ', faceShown: true, writId })
            expect(writs[0].legs[0].to).toEqual({ kind: 'table' })
            expect(endAt(writs[0])).toMatchObject({ kind: 'board' })
            expect(writs[0].legs[1].at).toBeGreaterThan(
                writs[0].legs[0].at + writs[0].legs[0].duration
            )
        }
    })

    it('R-4.4.4 a discarded writ goes under face down: its back flies from the seat to the deck, the same for every seat (S52)', async () => {
        const table = await emptyTable()
        const { seat, other } = table
        const writId: WritId = RoyalWrits[0].id
        const change = changeFrom(table, (to) => {
            to.getPlayerState(seat).writCount -= 1
        })
        const action = actionOf(seat, ActionType.DiscardWrit, { writId })
        const plans = [seat, other, undefined].map((viewerId) =>
            writsIn(planFlights({ ...change, action, viewerId }))
        )
        for (const writs of plans) {
            expect(writs).toHaveLength(1)
            expect(writs[0].face).toEqual({ kind: 'writ', faceShown: false })
            expect(writs[0].legs).toHaveLength(1)
            expect(endAt(writs[0])).toMatchObject({ kind: 'board' })
            expect(JSON.stringify(writs)).not.toContain(writId)
        }
        expect(plans[1]).toEqual(plans[0])
        expect(plans[2]).toEqual(plans[0])
    })

    it('R-4.4.3 a charter sealed at game end flies nothing: not its writ, not its seal', async () => {
        const table = await emptyTable()
        const { seat, host: game } = table
        game.edit((state) => {
            const player = state.getPlayerState(seat)
            player.sealCount = 1
            player.writCount = 1
        })
        const plan = planFlights(
            changeFrom(
                table,
                (to) => {
                    const player = to.getPlayerState(seat)
                    player.sealCount = 0
                    player.sealedCharterCount = 1
                },
                actionOf(seat, ActionType.ScoreGame)
            )
        )
        expect(plan.flights).toEqual([])
    })

    it('R-3.5 R-5.3 a Defend, a hand, writs held, charters and a pouch draft change nothing: every seat’s plan is the same', async () => {
        const table = await emptyTable()
        const { seat, other, host: game } = table
        const { id } = Spaces[0]
        const edit = (to: HydratedFeudumGameState) => {
            to.spaces[id].ruler = { playerId: seat, subject: false }
            to.getPlayerState(seat).shillings += 2
        }
        const plain = planFlights(changeFrom(table, edit, anAction(seat), seat))
        game.edit((state) => {
            state.getPlayerState(other).hand = ['defend']
            holdWrit(state, other, RoyalWrits[0].id)
            holdWrit(state, other, RoyalWrits[1].id)
        })
        const holding = planFlights(changeFrom(table, edit, anAction(seat), seat))
        expect(holding).toEqual(plain)
        const asOther = planFlights(changeFrom(table, edit, anAction(seat), other))
        expect(asOther).toEqual(plain)
    })

    it('R-5-H1 R-5.3 the plan reads nothing a seat may not know: every hidden field is a trap', async () => {
        const table = await emptyTable()
        const { seat } = table
        const change = changeFrom(
            table,
            (to) => {
                to.supply.haversack.food -= 1
                to.getPlayerState(seat).goods.food += 1
                to.getPlayerState(seat).sealCount += 1
                to.supply.sealPileCount -= 1
                to.flow.writDraw = {
                    playerId: seat,
                    drawnCount: 2,
                    keep: 1,
                    source: 'explore',
                    shovelsOffered: false,
                    drawn: []
                }
                to.getPlayerState(seat).writCount += 1
            },
            actionOf(seat, ActionType.Explore, {
                metadata: { drawnCount: 2, keep: 1, drawnWritIds: [] }
            }),
            'nobody'
        )
        const trapped: string[] = []
        for (const state of [change.from, change.to]) {
            for (const player of state.players) {
                for (const name of ['hand', 'writs', 'sealedCharters', 'deckKnowledge']) {
                    Object.defineProperty(player, name, {
                        get() {
                            trapped.push(name)
                            return undefined
                        }
                    })
                }
            }
            Object.defineProperty(state, 'vault', {
                get() {
                    trapped.push('vault')
                    return undefined
                }
            })
            if (state.flow.writDraw) {
                Object.defineProperty(state.flow.writDraw, 'drawn', {
                    get() {
                        trapped.push('drawn')
                        return undefined
                    }
                })
            }
        }
        planFlights(change)
        planDirectFlights(change)
        expect(trapped).toEqual([])
        for (const name of [
            /\.hand\b/,
            /\.writs\b/,
            /\.sealedCharters\b/,
            /deckKnowledge/,
            /[vV]ault/,
            /\.drawn\b/
        ]) {
            expect(flightPlanSource).not.toMatch(name)
        }
    })

    it('R-4.6-H2 a hidden bead draw: both candidates lift alike, and the outcome changes where one settles and nothing else', async () => {
        const table = await emptyTable()
        const { seat, host: game } = table
        const rosary = [Seals[0].id, Seals[Seals.length - 1].id]
        game.edit((state) => {
            state.guilds.monk.rosary = rosary
        })
        const candidates = hiddenBeadCandidates(hydrated(game.state))
        if (!candidates) {
            throw new Error('The rosary offers two candidates')
        }
        const drawing = (bead: SealId) =>
            rowOf(
                planFlights(
                    changeFrom(
                        table,
                        (to) => {
                            to.guilds.monk.rosary = to.guilds.monk.rosary.filter(
                                (one) => one !== bead
                            )
                            to.getPlayerState(seat).beads.push(bead)
                        },
                        anAction(seat)
                    )
                ),
                'seals'
            )
        const high = drawing(candidates.high)
        const low = drawing(candidates.low)
        const timing = (flights: readonly Flight[]) =>
            flights.map(({ legs }) => legs.map(({ at, duration }) => ({ at, duration })))
        expect(high).toHaveLength(2)
        expect(timing(high)).toEqual(timing(low))
        const lifts = (flights: readonly Flight[]) =>
            flights.map(({ face, from, legs }) => ({ face, from, lift: legs[0].to }))
        expect(lifts(high)).toEqual(lifts(low))
        const rise = (flight: Flight) => {
            const { from } = flight
            const lift = flight.legs[0].to
            return from.kind === 'board' && lift.kind === 'board'
                ? from.point.y - lift.point.y
                : NaN
        }
        expect(rise(high[0])).toBeGreaterThan(0)
        expect(rise(high[1])).toBe(rise(high[0]))
        const settles = (flights: readonly Flight[]) =>
            flights
                .map(endAt)
                .map(({ kind }) => kind)
                .toSorted()
        expect(settles(high)).toEqual(['board', 'seat'])
    })
})

describe('a copy on the layer', () => {
    async function sceneWithSource() {
        const table = await emptyTable()
        const { seat, host: game } = table
        game.edit((state) => addPawn(state, seat, 'knight', 'space.desert.3'))
        return planFlights(
            changeFrom(
                table,
                (to) => {
                    for (const pawn of to.getPlayerState(seat).pawns) {
                        delete pawn.spaceId
                    }
                },
                actionOf(seat, ActionType.Migrate)
            )
        )
    }

    it('R-3.6 the source hides the moment the copy leaves, and stays hidden while it flies; the copy runs from one rectangle to the other', async () => {
        const plan = await sceneWithSource()
        const { animator, stage } = rig()
        const { copies, timeline, duration } = await played(animator, plan)
        const [flight] = animator.flights
        const copy = copyOf(copies, flight.id)
        expect(stage.hiddenSources).toEqual([])
        timeline.time(0.001)
        const source = stage.sourceOf(flight.from)
        expect(source.style.visibility).toBe('hidden')
        const start = stage.locate(flight.from)
        const atStart = placeOf(copy)
        expect(atStart.x).toBeCloseTo(start.x, 0)
        expect(atStart.y).toBeCloseTo(start.y, 0)
        timeline.time(duration / 2)
        expect(source.style.visibility).toBe('hidden')
        timeline.progress(1)
        const end = stage.locate(endAt(flight))
        expect(placeOf(copy).x).toBeCloseTo(end.x, 1)
        expect(placeOf(copy).y).toBeCloseTo(end.y, 1)
        expect(source.style.visibility).toBe('hidden')
        // The target is never touched: only what the state shows at publish can put it there.
        expect(stage.sourceOf(endAt(flight)).style.visibility).toBe('')
    })

    it('R-3.6 both ends are measured again every frame, so a board framed or zoomed mid-flight carries the copy with it', async () => {
        const plan = await sceneWithSource()
        const { animator, stage } = rig()
        const { copies, timeline, duration } = await played(animator, plan)
        const [flight] = animator.flights
        const copy = copyOf(copies, flight.id)
        timeline.time(duration / 2)
        const framed = placeOf(copy)
        stage.zoom = 2
        timeline.time(duration / 2 + 0.0001)
        expect(placeOf(copy).x).toBeCloseTo(framed.x * 2, 0)
        timeline.progress(1)
        expect(placeOf(copy).x).toBeCloseTo(stage.locate(endAt(flight)).x, 1)
    })

    it('S66 R-3.6 settling empties the layer and shows every source in one stroke; a tween still running writes nothing (S66)', async () => {
        const plan = await sceneWithSource()
        const { animator, stage } = rig()
        const { copies, timeline, duration } = await played(animator, plan)
        const [flight] = animator.flights
        const copy = copyOf(copies, flight.id)
        timeline.time(duration / 2)
        const source = stage.sourceOf(flight.from)
        expect(source.style.visibility).toBe('hidden')
        const frozen = copy.style.transform
        animator.settle()
        // Synchronously: no frame can come between.
        expect(animator.flights).toEqual([])
        expect(source.style.visibility).toBe('')
        timeline.progress(1)
        expect(copy.style.transform).toBe(frozen)
        expect(source.style.visibility).toBe('')
    })

    it('R-3.6 a tween writes no reactive state: the copies’ array stands from the first frame to the last', async () => {
        const plan = await sceneWithSource()
        const { animator } = rig()
        const { timeline, duration } = await played(animator, plan)
        const standing = animator.flights
        for (let time = 0; time < duration; time += 0.05) {
            timeline.time(time)
            expect(animator.flights).toBe(standing)
        }
    })

    it('S65 reduced motion: no tween, the copy simply lands, in the same order and on the same lines', async () => {
        const plan = await sceneWithSource()
        const { animator, stage } = rig(true)
        const { copies, timeline, duration } = await played(animator, plan)
        const moving = timeline
            .getChildren()
            .filter((child: { duration(): number }) => child.duration() > 0)
        expect(moving).toEqual([])
        const [flight] = animator.flights
        const copy = copyOf(copies, flight.id)
        expect(duration).toBeCloseTo(plan.seconds)
        timeline.time(duration / 2)
        expect(copy.style.transform).toBe('')
        timeline.progress(1)
        const end = stage.locate(endAt(flight))
        expect(placeOf(copy).x).toBeCloseTo(end.x, 1)
        expect(stage.sourceOf(flight.from).style.visibility).toBe('hidden')
        animator.settle()
        expect(stage.hiddenSources).toEqual([])
    })

    it('S65 reduced motion with no Action: nothing is drawn at all, the state simply shows', async () => {
        const table = await emptyTable()
        const { seat } = table
        const { animator } = rig(true)
        const change = changeFrom(table, (to) => {
            to.getPlayerState(seat).goods.food += 1
            to.supply.haversack.food -= 1
        })
        expect(animator.plan(change).flights).toEqual([])
    })

    it('R-3.6 a copy that turns over holds both faces, and shows one at a time', async () => {
        const table = await emptyTable()
        const { seat } = table
        const plan = planFlights(
            changeFrom(table, (to) => addPawn(to, seat, 'knight', 'space.desert.3'), anAction(seat))
        )
        const { animator } = rig()
        const { copies, timeline, duration } = await played(animator, plan)
        const [flight] = animator.flights
        const copy = copyOf(copies, flight.id)
        timeline.time(duration * 0.1)
        expect(copy.shownSides).toEqual(['first'])
        timeline.progress(1)
        expect(copy.shownSides).toEqual(['then'])
    })
})

describe('no Action, and nothing at all', () => {
    it('S63 the fast fallback: every copy straight within the bound; flips, flashes and holds cut; writs are backs', async () => {
        const table = await emptyTable()
        const { seat, host: game } = table
        game.edit((state) => addPawn(state, seat, 'knight', 'space.desert.3'))
        const tileId = hydrated(game.state).regionStacks.desert[0]
        const plan = planDirectFlights(
            changeFrom(table, (to) => {
                const player = to.getPlayerState(seat)
                for (const pawn of player.pawns) {
                    delete pawn.spaceId
                }
                player.goods.food += 2
                to.supply.haversack.food -= 2
                to.regionStacks.desert.shift()
                player.regionTiles.push(tileId)
                player.writCount += 1
                to.supply.sealPileCount -= 1
                player.sealCount += 1
            })
        )
        expect(plan.flights.length).toBeGreaterThan(4)
        expect(plan.seconds).toBeLessThanOrEqual(ContractFastSeconds)
        for (const flight of plan.flights) {
            expect(flight.flash).toBeUndefined()
            expect(flight.legs).toHaveLength(1)
            expect(flight.legs[0].at).toBe(0)
            expect(flight.legs[0].duration).toBeLessThanOrEqual(ContractFastSeconds)
            expect(flight.legs[0].arc).toBeUndefined()
            expect(flight.legs[0].turnTo).toBeUndefined()
            expect(flight.legs[0].fade).toBeUndefined()
            if (flight.face.kind === 'writ') {
                expect(flight.face.faceShown).toBe(false)
            }
        }
    })

    /** R-3.10.1 A seat about to Explore, its layer's rectangles the spec's own. */
    /** Settles the moment the flights are scheduled, ahead of every timer: no race with a short flight. */
    function whenFlying(animator: FlightAnimator) {
        const play = animator.play.bind(animator)
        let scheduled: () => void = () => undefined
        const flying = new Promise<void>((resolve) => {
            scheduled = resolve
        })
        const plays = vi.spyOn(animator, 'play').mockImplementation(async (...args) => {
            await play(...args)
            scheduled()
        })
        return { flying, plays }
    }

    async function aboutToExplore() {
        const table = await seatedAtCards(['explore', 'tax'], (state, { seat }) => {
            placeMarker(state, seat, emptySpace(state, 'outpost'))
            buildFeudum(state, seat, emptySpace(state, 'farm'))
            state.recomputeRanks()
            returnGoods(state, seat)
        })
        host = table.host
        const stage = new FakeStage()
        table.session.flightAnimator.useStage(stage)
        return { ...table, stage, animator: table.session.flightAnimator }
    }

    it('S63 a connection coming back: the state appears with nothing on the layer', async () => {
        const { host: game, seat, session, animator } = await aboutToExplore()
        const plans = vi.spyOn(animator, 'plan')
        game.sendUnheard(seat, { type: ActionType.Explore, revealsInfo: true })
        await game.reconcile(seat)
        await settled(session)
        expect(session.gameState.flow.writDraw?.playerId).toBe(seat)
        expect(plans).not.toHaveBeenCalled()
        expect(animator.flights).toEqual([])
    })

    it('S63 a step in history is the fast fallback: within the bound, with a piece crossing, nothing left hidden', async () => {
        const game = new FeudumHost()
        host = game
        await game.playStartingGoods()
        await game.playStartingPawns(1)
        const seat = game.order.find((id) => id !== game.setupSeat) ?? game.setupSeat
        const session = await game.openSeat(seat)
        const stage = new FakeStage()
        session.flightAnimator.useStage(stage)
        const plays = vi.spyOn(session.flightAnimator, 'play')
        const plans = vi.spyOn(session.flightAnimator, 'plan')
        await session.history.goToPreviousAction()
        await settled(session)
        const [plan] = plays.mock.calls[0]
        expect(plans.mock.calls[0][0].action).toBeUndefined()
        expect(plan.flights.length).toBeGreaterThan(0)
        expect(plan.seconds).toBeLessThanOrEqual(ContractFastSeconds)
        expect(session.flightAnimator.flights).toEqual([])
        expect(stage.hiddenSources).toEqual([])
    })

    it('R-3.10.1 the target does not show a piece before it lands: the state waits for the last copy', async () => {
        const { host: game, seat, session, animator } = await aboutToExplore()
        const clock = new AnimationContext().actionTimeline.parent
        clock?.timeScale(1)
        try {
            const { flying, plays } = whenFlying(animator)
            const shown: { readonly at: number; readonly draw: unknown }[] = []
            const before = session.beforeNewState.bind(session)
            let flewAt = 0
            vi.spyOn(session, 'beforeNewState').mockImplementation(() => {
                shown.push({
                    at: performance.now() - flewAt,
                    draw: session.gameState.flow.writDraw
                })
                before()
            })
            const sent = game.send(seat, { type: ActionType.Explore, revealsInfo: true })
            await flying
            expect(animator.flights.length).toBeGreaterThan(0)
            flewAt = performance.now()
            expect(session.gameState.flow.writDraw).toBeUndefined()
            await sent
            await settled(session)
            const { seconds } = plays.mock.calls[0][0]
            expect(seconds).toBeGreaterThan(0.3)
            expect(shown[0].draw).toBeUndefined()
            expect(shown[0].at).toBeGreaterThanOrEqual(seconds * 1000 * 0.8)
            expect(session.gameState.flow.writDraw?.playerId).toBe(seat)
        } finally {
            clock?.timeScale(40)
        }
    })

    it('S66 a second Action arriving mid-flight: the latest state shows, the layer is empty, nothing stays hidden', async () => {
        const { host: game, seat, session, animator, stage } = await aboutToExplore()
        const { flying } = whenFlying(animator)
        const first = game.send(seat, { type: ActionType.Explore, revealsInfo: true })
        await flying
        expect(animator.flights.length).toBeGreaterThan(0)
        const drawn = hydrated(game.state).flow.writDraw?.drawn ?? []
        const second = game.send(seat, { type: ActionType.KeepWrits, keep: drawn.slice(0, 1) })
        await Promise.all([first, second])
        await settled(session)
        expect(stage.everHidden).toBe(true)
        expect(animator.flights).toEqual([])
        expect(stage.hiddenSources).toEqual([])
        expect(session.gameState.flow.writDraw).toBeUndefined()
        expect(session.gameState.getPlayerState(seat).writCount).toBe(
            hydrated(game.state).getPlayerState(seat).writCount
        )
    })

    it('S66 R-3.6 the session settles both layers in the stroke that shows the state, a flight running or not', async () => {
        const { session, animator, stage } = await aboutToExplore()
        const settledBoard = vi.spyOn(session.boardAnimator, 'settle')
        const context = new AnimationContext()
        await animator.play(
            {
                flights: [
                    {
                        id: 'one',
                        row: 'goods',
                        face: { kind: 'good', good: 'food' },
                        from: {
                            kind: 'seat',
                            playerId: session.myPlayerId ?? '',
                            part: { part: 'good', good: 'food' },
                            hide: true
                        },
                        legs: [{ to: { kind: 'table' }, at: 0, duration: 1 }]
                    }
                ],
                seconds: 1
            },
            context,
            0
        )
        context.actionTimeline.pause().time(0.5)
        expect(stage.hiddenSources).toHaveLength(1)
        session.beforeNewState()
        expect(settledBoard).toHaveBeenCalledOnce()
        expect(animator.flights).toEqual([])
        expect(stage.hiddenSources).toEqual([])
    })
})
