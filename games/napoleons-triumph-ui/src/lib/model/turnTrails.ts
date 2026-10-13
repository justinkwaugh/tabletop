import { RecordedHistory, type Point } from '@tabletop/common'
import { isEndTurn, samePosition } from '@tabletop/napoleons-triumph'
import { LOCALE_GEOMETRY } from '$lib/map/boardGeometry.js'
import { screenAxes } from '$lib/utils/boardView.js'
import {
    layoutPieces,
    midpoint,
    type BlockSprite,
    type LayoutOptions
} from '$lib/utils/pieceLayout.js'
import { arrowAlong, drawnArrow, type DrawnArrow } from '$lib/utils/wayArrow.js'
import {
    movementsOf,
    onBoard,
    piecesOf,
    standingOf,
    type RecordedGame,
    type Standing
} from './moveReplay.js'

export interface Trail {
    /** Which of the turn's moves it was, counting from one. The arrows of one action share a number. */
    order: number
    arrow: DrawnArrow
    line: Point[]
    /** Halfway along the arrow, where its number goes. */
    middle: Point
    /** The way from there to the side the number stands on: upwards on the screen, or to the right of an arrow that runs straight up or down it. */
    aside: Point
}

const SIDEWAYS = 0.2

function blocksOf(standing: Standing, view: LayoutOptions): BlockSprite[] {
    return layoutPieces(piecesOf(standing), view).flatMap((sprite) => sprite.blocks)
}

function centreOf(blocks: readonly BlockSprite[], unitIds: readonly string[]): Point | undefined {
    const centres = blocks.filter((block) => unitIds.includes(block.unit.id))
    return centres.length > 0 ? midpoint(centres.map((block) => block.centre)) : undefined
}

function span(from: Point, to: Point): number {
    return Math.hypot(to.x - from.x, to.y - from.y)
}

function halfway(line: readonly Point[]): { middle: Point; along: Point } {
    const legs = line.slice(1).map((to, index) => ({ from: line[index], to }))
    let left = legs.reduce((sum, leg) => sum + span(leg.from, leg.to), 0) / 2
    const leg = legs.find((candidate) => {
        const length = span(candidate.from, candidate.to)
        if (left <= length) {
            return true
        }
        left -= length
        return false
    })
    const { from, to } = leg ?? legs[legs.length - 1]
    const length = span(from, to) || 1
    const along = { x: (to.x - from.x) / length, y: (to.y - from.y) / length }
    return { middle: { x: from.x + along.x * left, y: from.y + along.y * left }, along }
}

function numbered(order: number, line: Point[], rotation: number): Trail[] {
    const arrow = drawnArrow(line)
    if (!arrow) {
        return []
    }
    const { middle, along } = halfway(line)
    const { right, down } = screenAxes(rotation)
    const across = { x: -along.y, y: along.x }
    const upwards = -(across.x * down.x + across.y * down.y)
    const rightwards = across.x * right.x + across.y * right.y
    const sign = Math.abs(upwards) > SIDEWAYS ? Math.sign(upwards) : Math.sign(rightwards) || 1
    return [{ order, arrow, line, middle, aside: { x: across.x * sign, y: across.y * sign } }]
}

/**
 * An arrow for every move made since the last turn ended, numbered in the order the moves were made.
 * Each runs from where the pieces stood to where they stand on the board as it is drawn, or to where
 * they stopped if they have since moved on or left the board.
 */
export function turnTrails(
    game: RecordedGame,
    standing: readonly BlockSprite[],
    view: LayoutOptions
): Trail[] {
    const turn = game.actions.slice(game.actions.findLastIndex((action) => isEndTurn(action)) + 1)
    const transitions = new RecordedHistory(game.state, turn).select(standingOf)
    const trails: Trail[] = []
    let order = 0
    for (const action of turn) {
        const transition = transitions.get(action.id)
        const movements = transition?.before
            ? movementsOf(action, transition.before, transition.after)
            : []
        if (!transition?.before || movements.length === 0) {
            continue
        }
        order += 1
        const left = blocksOf(transition.before, view)
        const stopped = blocksOf(transition.after, view)
        for (const movement of movements) {
            const moved = (block: BlockSprite) => movement.unitIds.includes(block.unit.id)
            const here = standing.filter(
                (block) => moved(block) && samePosition(block.unit.position, movement.to)
            )
            const stayed = standing.filter(
                (block) => !moved(block) && samePosition(block.unit.position, movement.from)
            )
            const start = movement.from ? centreOf(left, movement.unitIds) : movement.entry
            const end = centreOf(here.length > 0 ? here : stopped, movement.unitIds)
            if (!start || !end) {
                continue
            }
            const bends = movement.road.slice(0, -1).map((locale) => LOCALE_GEOMETRY[locale].anchor)
            const [tail, ...onwards] = arrowAlong([start, ...bends, end], stayed, here)
            if (tail) {
                trails.push(...numbered(order, [onBoard(tail), ...onwards], view.rotation))
            }
        }
    }
    return trails
}
