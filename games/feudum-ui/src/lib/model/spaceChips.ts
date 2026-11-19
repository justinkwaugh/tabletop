import type { HydratedFeudumGameState, SpaceId } from '@tabletop/feudum'
import { PawnSize, SpaceRingFrame, spaceGeometry, type Point } from '$lib/utils/boardGeometry.js'
import { isPickable } from './boardChrome.js'
import {
    chipOf,
    feudumTarget,
    monsterTarget,
    pawnTarget,
    roleOf,
    spaceTarget,
    type BoardChip,
    type BoardOffer,
    type BoardTarget
} from './boardOffer.js'
import { piecesOn, slottedPieces, type MapPiece } from './mapView.js'

/** Contract, Pick conventions: a chip's height, and its width from its words or its pieces. */
export const ChipHeight = 34
export const ChipCharWidth = 13.5
export const ChipPieceSize = 24
export const ChipStepWidth = 18
export const ChipGap = 4
export const ChipPadding = 10

/** The frame a piece's pick draws round it on a space. */
export const PieceFrame = PawnSize + 8

/** Between two chips in a row. */
const RowGap = 6
/** The count chip's half height (`CountChip`), which a row keeps clear of. */
const CountHalf = 10

/** A chip's art piece and where it starts from the chip's left edge. */
export interface PlacedArt {
    readonly x: number
    readonly text?: string
}

/** Each art piece's place from the chip's left edge, and the chip's width. */
export function chipLayout(chip: BoardChip): {
    readonly pieces: readonly PlacedArt[]
    readonly width: number
} {
    if (!chip.art) {
        return { pieces: [], width: 20 + chip.label.length * ChipCharWidth }
    }
    let x = ChipPadding
    const pieces = chip.art.map((art): PlacedArt => {
        const at = x
        if (art.kind === 'step') {
            x += ChipStepWidth + ChipGap
            return { x: at }
        }
        if (art.kind === 'disc') {
            x += ChipPieceSize + ChipGap
            return { x: at }
        }
        const text = String(art.count)
        x += ChipPieceSize + ChipGap + text.length * ChipCharWidth + ChipGap
        return { x: at, text }
    })
    return { pieces, width: x - ChipGap + ChipPadding }
}

/**
 * Chips side by side, none over another: each as near the x it wants as the row allows, the row
 * centred on what they want, in the order they want. Gives each chip's centre.
 */
export function chipRow(
    wanted: readonly { readonly x: number; readonly width: number }[]
): number[] {
    const order = wanted.map((_, index) => index).sort((a, b) => wanted[a].x - wanted[b].x)
    const packed: number[] = []
    order.forEach((index, place) => {
        if (place === 0) {
            packed.push(wanted[index].x)
            return
        }
        const before = order[place - 1]
        const least = (wanted[before].width + wanted[index].width) / 2 + RowGap
        packed.push(Math.max(wanted[index].x, packed[place - 1] + least))
    })
    const shift =
        order.reduce((total, index, place) => total + wanted[index].x - packed[place], 0) /
        Math.max(1, order.length)
    const centres = new Array<number>(wanted.length)
    order.forEach((index, place) => {
        centres[index] = packed[place] + shift
    })
    return centres
}

function targetOf(piece: MapPiece): BoardTarget {
    return piece.kind === 'pawn'
        ? pawnTarget(piece.playerId, piece.n)
        : monsterTarget(piece.monster)
}

/**
 * R-4.1 The pieces drawn on a space, in its slots: a piece the offer lights takes a slot first so it
 * can be pressed; past four, a count.
 */
export function shownOn(state: HydratedFeudumGameState, offer: BoardOffer, spaceId: SpaceId) {
    const pieces = piecesOn(state, spaceId)
    const pressable = (piece: MapPiece) => isPickable(roleOf(offer, targetOf(piece)))
    return slottedPieces([
        ...pieces.filter(pressable),
        ...pieces.filter((piece) => !pressable(piece))
    ])
}

/** A chip and where its centre stands, in board units. */
export interface PlacedChip {
    readonly target: BoardTarget
    readonly chip: BoardChip
    readonly at: Point
}

/**
 * Contract, Pick conventions: every chip on a space, its own and its pieces', in one row so that
 * none covers another, or a piece that takes a press. A piece's chip alone stands over the piece; the
 * space's alone over its disc. With a piece's chip there, or a piece that takes a press, the row
 * stands over the pieces, each chip as near its target as the row allows, clear of the count chip.
 */
export function spaceChips(
    state: HydratedFeudumGameState,
    offer: BoardOffer,
    spaceId: SpaceId
): readonly PlacedChip[] {
    const geometry = spaceGeometry(spaceId)
    const { shown, more } = shownOn(state, offer, spaceId)
    const placed = shown.map((piece, slot) => {
        const target = targetOf(piece)
        return { target, chip: chipOf(offer, target), slot: geometry.pieceSlots[slot] }
    })
    const pieces = placed.flatMap(({ target, chip, slot }) =>
        chip ? [{ target, chip, slot }] : []
    )
    // A piece that takes a press, or carries a chip, keeps every chip on its space above it.
    const kept = placed.filter(({ target, chip }) => chip || isPickable(roleOf(offer, target)))
    const own = [spaceTarget(spaceId), feudumTarget(spaceId)].flatMap((target) => {
        const chip = chipOf(offer, target)
        return chip ? [{ target, chip }] : []
    })
    const centre = geometry.centre
    const overDisc = centre.y - SpaceRingFrame / 2 - 24
    const overPieces = Math.min(...kept.map(({ slot }) => slot.y - PieceFrame / 2 - 24))
    const clearOfCount = geometry.countChip.y - CountHalf - RowGap - ChipHeight / 2
    const y =
        kept.length === 0 ? overDisc : more > 0 ? Math.min(overPieces, clearOfCount) : overPieces
    const row = [
        ...pieces.map(({ target, chip, slot }) => ({ target, chip, x: slot.x })),
        ...own.map(({ target, chip }) => ({ target, chip, x: centre.x }))
    ]
    const xs = chipRow(row.map(({ chip, x }) => ({ x, width: chipLayout(chip).width })))
    return row.map(({ target, chip }, index) => ({ target, chip, at: { x: xs[index], y } }))
}
