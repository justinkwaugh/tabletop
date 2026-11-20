import type { Point } from '@tabletop/common'
import type { HydratedFeudumGameState, SpaceId } from '@tabletop/feudum'
import { PawnSize, SpaceRingFrame, spaceGeometry } from '$lib/utils/boardGeometry.js'
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

/** Contract, Pick conventions. */
export const ChipHeight = 34
export const ChipCharWidth = 13.5
export const ChipPieceSize = 24
export const ChipStepWidth = 18
export const ChipGap = 4
export const ChipPadding = 10

export const PieceFrame = PawnSize + 8

const RowGap = 6
const CountHalf = 10

export interface PlacedArt {
    readonly x: number
    readonly text?: string
}

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

/** R-4.1 A piece the offer lights takes a slot first, so it can be pressed. */
export function shownOn(state: HydratedFeudumGameState, offer: BoardOffer, spaceId: SpaceId) {
    const pieces = piecesOn(state, spaceId)
    const pressable = (piece: MapPiece) => isPickable(roleOf(offer, targetOf(piece)))
    return slottedPieces([
        ...pieces.filter(pressable),
        ...pieces.filter((piece) => !pressable(piece))
    ])
}

export interface PlacedChip {
    readonly target: BoardTarget
    readonly chip: BoardChip
    readonly at: Point
}

/** Contract, Pick conventions: a space's chips share one row, over no chip or pressable piece. */
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
