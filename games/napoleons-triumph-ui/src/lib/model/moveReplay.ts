import {
    RecordedHistory,
    assertExists,
    type BoundingBox,
    type GameAction,
    type Point
} from '@tabletop/common'
import {
    AUSTERLITZ,
    isAdvance,
    isAssignLosses,
    isAttach,
    isCounterAttack,
    isDeclareAttack,
    isDeclareDefense,
    isDeclareFeint,
    isMove,
    isOccupy,
    isPressAttack,
    isRegroup,
    isOnMap,
    samePosition,
    type Commander,
    type LocaleId,
    type NapoleonsTriumphProjectedState,
    type Position,
    type ProjectedUnit
} from '@tabletop/napoleons-triumph'
import {
    APPROACH_GEOMETRY,
    BOARD_HEIGHT,
    BOARD_WIDTH,
    ENTRY_GEOMETRY,
    LOCALE_GEOMETRY
} from '$lib/map/boardGeometry.js'
import { blockCorners, blockSamples } from '$lib/utils/blockShape.js'
import { boundsOf } from '$lib/utils/boardView.js'
import { flagMarks, type FlagBearer, type FlagMark, type FlagView } from '$lib/utils/flagLayout.js'
import {
    heldApproaches,
    layoutPieces,
    midpoint,
    type BlockSprite,
    type BoardPieces,
    type GroupSprite,
    type HeldApproach,
    type PieceGroup,
    type SingledOut
} from '$lib/utils/pieceLayout.js'
import { arrowAlong, drawnArrow, lineSamples, type DrawnArrow } from '$lib/utils/wayArrow.js'
import {
    committedRoles,
    committedUnits,
    type BattleRole,
    type VisibleAttack
} from './battleStage.js'
import { attackMarkOf, type AttackMark } from './attackMark.js'
import { belongsToAnAttack } from './historyChapters.js'

export interface Standing {
    units: ProjectedUnit[]
    commanders: Commander[]
    attack?: VisibleAttack
}

export interface MoveReplay {
    actionId: string
    index: number
    time: string
    text: string
    action: GameAction
    before: Standing
    after: Standing
}

export interface RecordedGame {
    state: NapoleonsTriumphProjectedState
    actions: readonly GameAction[]
}

export interface Caption {
    time: string
    text: string
}

export interface Movement {
    unitIds: string[]
    to: Position
    from?: Position
    entry?: Point
    road: LocaleId[]
}

export function standingOf(state: Readonly<NapoleonsTriumphProjectedState>): Standing {
    return { units: state.units, commanders: state.commanders, attack: state.attack }
}

export function piecesOf(standing: Standing, units = standing.units): BoardPieces {
    return {
        units,
        commander: (id) => {
            const commander = standing.commanders.find((candidate) => candidate.id === id)
            assertExists(commander, `Unknown commander ${id}`)
            return commander
        }
    }
}

function positionKey(position: Position | undefined): string {
    return position ? `${position.locale}:${position.approach ?? 'reserve'}` : 'off the map'
}

export function movementsOf(action: GameAction, before: Standing, after: Standing): Movement[] {
    const stood = new Map(before.units.map((unit) => [unit.id, unit.position]))
    const marched = isMove(action) ? action.order : undefined
    const entry = marched?.entryId ? ENTRY_GEOMETRY[marched.entryId].at : undefined
    const movements = new Map<string, Movement>()
    for (const unit of after.units) {
        const from = stood.get(unit.id)
        const to = unit.position
        if (!to || samePosition(from, to) || (!from && !entry)) {
            continue
        }
        const key = `${positionKey(from)}>${positionKey(to)}`
        const movement = movements.get(key) ?? {
            unitIds: [],
            to,
            from,
            entry: from ? undefined : entry,
            road: marched?.unitIds.includes(unit.id) ? (marched.road ?? []) : []
        }
        movement.unitIds.push(unit.id)
        movements.set(key, movement)
    }
    return [...movements.values()]
}

/** What an action did that can be seen on the map: pieces moved, set down or lost, the attack it was a step of, and the units it was about. */
interface Subject {
    movements: Movement[]
    lost: ProjectedUnit[]
    attack?: VisibleAttack
    locales: LocaleId[]
    unitIds: string[]
}

function unitsNamedBy(action: GameAction, attack: VisibleAttack | undefined): string[] {
    if (isDeclareDefense(action) || isCounterAttack(action) || isAdvance(action)) {
        return action.unitIds
    }
    if (isDeclareAttack(action) || isDeclareFeint(action) || isOccupy(action)) {
        return action.orders.flatMap((order) => order.unitIds)
    }
    if (isAssignLosses(action)) {
        return Object.keys(action.allocation)
    }
    if (isRegroup(action)) {
        return Object.values(action.keep)
    }
    if (isAttach(action)) {
        return [action.unitId]
    }
    return isPressAttack(action) ? (attack?.defenseLeaderIds ?? []) : []
}

function subjectOf(action: GameAction, before: Standing, after: Standing): Subject {
    const movements = movementsOf(action, before, after)
    const stood = new Map(before.units.map((unit) => [unit.id, unit.position]))
    const remaining = new Set(after.units.map((unit) => unit.id))
    const lost = before.units.filter((unit) => isOnMap(unit) && !remaining.has(unit.id))
    const setDown = after.units.filter((unit) => isOnMap(unit) && !stood.get(unit.id))
    const attack = belongsToAnAttack(action) ? (after.attack ?? before.attack) : undefined
    const joined = isAttach(action)
        ? after.commanders.find((commander) => commander.id === action.commanderId)
        : undefined
    return {
        movements,
        lost,
        attack,
        unitIds: [
            ...movements.flatMap((movement) => movement.unitIds),
            ...lost.map((unit) => unit.id),
            ...setDown.map((unit) => unit.id),
            ...unitsNamedBy(action, attack)
        ],
        locales: [
            ...movements.flatMap((movement) => [
                ...(movement.from ? [movement.from.locale] : []),
                ...movement.road,
                movement.to.locale
            ]),
            ...[...lost, ...setDown].flatMap((unit) => unit.position?.locale ?? []),
            ...(attack
                ? [attack.attackApproach, attack.defenseApproach].map(
                      (approach) => AUSTERLITZ.approach(approach).locale
                  )
                : []),
            ...(joined?.position ? [joined.position.locale] : [])
        ]
    }
}

export function moveReplayOf(
    game: RecordedGame,
    actionId: string,
    caption: Caption
): MoveReplay | undefined {
    const position = game.actions.findIndex((action) => action.id === actionId)
    if (position < 0) {
        return undefined
    }
    const action = game.actions[position]
    const transition = new RecordedHistory(game.state, game.actions.slice(position))
        .select(standingOf)
        .get(actionId)
    if (!transition?.before) {
        return undefined
    }
    const { before, after } = transition
    return subjectOf(action, before, after).locales.length > 0
        ? { actionId, index: action.index ?? position, ...caption, action, before, after }
        : undefined
}

export interface MoveReplayScene {
    sprites: GroupSprite[]
    held: HeldApproach[]
    /** Places left and pieces lost, drawn washed out where they stood. */
    left: BlockSprite[]
    arrows: DrawnArrow[]
    attackMark?: AttackMark
    roles: Record<string, BattleRole>
    /** Where nothing moved, the units of a stack the action named others of: drawn washed out, so the ones it meant stand out. */
    bystanderIds: string[]
    keptClear: Point[]
    focus: BoundingBox
}

const FOCUS_PADDING = 70
const FOCUS_ASPECT = 4 / 3
const NARROWEST_FOCUS = 560
const BOARD_MARGIN = 10

const BOARD_CORNERS: Point[] = [
    { x: 0, y: 0 },
    { x: BOARD_WIDTH, y: 0 },
    { x: BOARD_WIDTH, y: BOARD_HEIGHT },
    { x: 0, y: BOARD_HEIGHT }
]

// Deliberate: the places left are laid out as pieces of their own beside those that stayed, so a
// corps some units left keeps the shape it had and those places are not hidden under it.
function placeLeftId(unitId: string): string {
    return `${unitId} (left)`
}

function within(value: number, low: number, high: number): number {
    return Math.min(Math.max(value, low), high)
}

export function onBoard(point: Point): Point {
    return {
        x: within(point.x, BOARD_MARGIN, BOARD_WIDTH - BOARD_MARGIN),
        y: within(point.y, BOARD_MARGIN, BOARD_HEIGHT - BOARD_MARGIN)
    }
}

function slidOnto(start: number, size: number, low: number, room: number): number {
    return size >= room ? low + (room - size) / 2 : within(start, low, low + room - size)
}

function framed(bounds: BoundingBox, rotation: number): BoundingBox {
    const padded = {
        width: Math.max(bounds.width + FOCUS_PADDING * 2, NARROWEST_FOCUS),
        height: bounds.height + FOCUS_PADDING * 2
    }
    const width = Math.max(padded.width, padded.height * FOCUS_ASPECT)
    const height = width / FOCUS_ASPECT
    const board = boundsOf(BOARD_CORNERS, rotation)
    return {
        x: slidOnto(bounds.x + bounds.width / 2 - width / 2, width, board.x, board.width),
        y: slidOnto(bounds.y + bounds.height / 2 - height / 2, height, board.y, board.height),
        width,
        height
    }
}

function arrowLine(
    movement: Movement,
    left: readonly BlockSprite[],
    arrived: readonly BlockSprite[]
): Point[] {
    const start = left.length > 0 ? midpoint(left.map((block) => block.centre)) : movement.entry
    if (!start || arrived.length === 0) {
        return []
    }
    const bends = movement.road.slice(0, -1).map((locale) => LOCALE_GEOMETRY[locale].anchor)
    const end = midpoint(arrived.map((block) => block.centre))
    const [tail, ...onwards] = arrowAlong([start, ...bends, end], left, arrived)
    return tail ? [onBoard(tail), ...onwards] : []
}

// The arrow belongs to the attack while it is being made; pieces crossing to the approach or over it afterwards are shown by where they went.
function attackMarkIn(
    action: GameAction,
    attack: VisibleAttack | undefined
): AttackMark | undefined {
    const crossesAfterwards = isAdvance(action) || (isOccupy(action) && !action.artilleryStays)
    return attack && !crossesAfterwards ? attackMarkOf(attack, action) : undefined
}

function firstPlaceOnTheWay(movement: Movement): Point {
    const [next] = movement.road
    if (next !== undefined) {
        return LOCALE_GEOMETRY[next].anchor
    }
    return movement.to.approach === undefined
        ? LOCALE_GEOMETRY[movement.to.locale].anchor
        : APPROACH_GEOMETRY[movement.to.approach].centre
}

// Deliberate: a picture must not tell anyone but the owner which of a stack a unit was. The places
// left stand at the end of their stack towards where the pieces went, units lost and units the
// action names at the end towards the attack's approach, whichever of the stack they really were.
function singledOutBy(
    movements: readonly Movement[],
    lost: readonly ProjectedUnit[],
    attack: VisibleAttack | undefined,
    namedIds: readonly string[]
): SingledOut[] {
    const fought = attack ? APPROACH_GEOMETRY[attack.attackApproach].centre : undefined
    return [
        ...movements.map((movement) => ({
            towards: firstPlaceOnTheWay(movement),
            unitIds: movement.unitIds.map(placeLeftId)
        })),
        { towards: fought, unitIds: lost.map((unit) => placeLeftId(unit.id)) },
        ...committedUnits(attack),
        { towards: fought, unitIds: namedIds }
    ]
}

export function moveReplayScene(
    replay: MoveReplay,
    rotation: number,
    readBy?: string
): MoveReplayScene {
    const { action, before, after } = replay
    const { movements, lost, attack, locales, unitIds } = subjectOf(action, before, after)
    const movedIds = movements.flatMap((movement) => movement.unitIds)
    const stood = new Map(
        [
            ...before.units.filter((unit) => movedIds.includes(unit.id) && isOnMap(unit)),
            ...lost
        ].map((unit) => [placeLeftId(unit.id), unit])
    )
    const laidOut = layoutPieces(
        piecesOf(after, [
            ...after.units.flatMap((unit) => {
                const was = stood.get(placeLeftId(unit.id))
                return was ? [{ ...was, id: placeLeftId(unit.id) }, unit] : [unit]
            }),
            ...lost.map((unit) => ({ ...unit, id: placeLeftId(unit.id) }))
        ]),
        { rotation, readBy, singledOut: singledOutBy(movements, lost, attack, unitIds) }
    )
    const left = laidOut
        .flatMap((sprite) => sprite.blocks)
        .flatMap((block) => {
            const unit = stood.get(block.unit.id)
            return unit ? [{ ...block, unit }] : []
        })
    const sprites = laidOut.flatMap((sprite) => {
        const blocks = sprite.blocks.filter((block) => !stood.has(block.unit.id))
        const units = sprite.group.units.filter((unit) => !stood.has(unit.id))
        return blocks.length > 0 ? [{ ...sprite, blocks, group: { ...sprite.group, units } }] : []
    })
    const standing = sprites.flatMap((sprite) => sprite.blocks)
    const ofMovement = (movement: Movement) => (block: BlockSprite) =>
        movement.unitIds.includes(block.unit.id)
    const lines = movements.map((movement) =>
        arrowLine(
            movement,
            left.filter(ofMovement(movement)),
            standing.filter(ofMovement(movement))
        )
    )
    const arrived = standing.filter((block) => movedIds.includes(block.unit.id))
    const shown = [
        ...locales.flatMap((locale) => LOCALE_GEOMETRY[locale].outline),
        ...[...left, ...arrived].flatMap(blockCorners),
        ...lines.flat()
    ]
    return {
        sprites,
        held: heldApproaches(sprites),
        left,
        arrows: lines.flatMap((line) => drawnArrow(line) ?? []),
        attackMark: attackMarkIn(action, attack),
        roles: attack ? committedRoles(attack) : {},
        bystanderIds:
            movements.length > 0
                ? []
                : sprites
                      .map((sprite) => sprite.group.units.map((unit) => unit.id))
                      .filter((stack) => stack.some((id) => unitIds.includes(id)))
                      .flat()
                      .filter((id) => !unitIds.includes(id)),
        keptClear: [...lines.flatMap(lineSamples), ...left.flatMap(blockSamples)],
        focus: framed(boundsOf(shown, rotation), rotation)
    }
}

export function replayFlags(
    scene: MoveReplayScene,
    view: FlagView,
    bearerOf: (group: PieceGroup) => FlagBearer
): FlagMark[] {
    return flagMarks(scene.sprites, view, scene.keptClear, bearerOf)
}
