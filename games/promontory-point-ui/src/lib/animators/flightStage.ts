import type { BoundingBox } from '@tabletop/common'
import type { RailroadId, SpaceId } from '@tabletop/promontory-point'
import { BOARD_BOUNDS } from '$lib/utils/boardGeometry.js'
import type { Flights, Hideable, ScreenRect } from './flights.svelte.js'

// A thing on the table where a flight starts or ends: its element and where it is on screen.
export type StageSpot = { element: Hideable; rect: ScreenRect }

// Where the table's things are on screen now, read when an action's flights are planned. Every
// answer is for an element shown in the flight layer's root (the full-screen dialog while it is
// open) and not already hidden by a flight; undefined when there is none.
export interface FlightStage {
    // The viewer's own hand piece of this railroad in its turn (beside the map, or in the
    // phone's bar), the deciding seat's own.
    turnPiece(railroadId: RailroadId): StageSpot | undefined
    // Where the viewer's own hand slot at `index` stands, or would stand.
    handSlot(index: number): ScreenRect | undefined
    // A seat's row in the seat ledger: a piece-sized box at its name, while the row is on screen.
    seatRowPiece(playerId: string): ScreenRect | undefined
    // A seat's holding of a railroad in the seat ledger: a card-shaped box on its count, while
    // the row is on screen.
    seatShareCell(playerId: string, railroadId: RailroadId): ScreenRect | undefined
    // The open seat's hand piece: of this railroad face up, or concealed when undefined.
    seatPiece(playerId: string, railroadId: RailroadId | undefined): StageSpot | undefined
    // Every hand piece the open seat shows, in order (the kept piece apart).
    seatHandPieces(playerId: string): StageSpot[]
    // Where the hand piece at `index` stands, or would stand, in the open seat.
    seatHandSlot(playerId: string, index: number): ScreenRect | undefined
    // The share cards the open seat's stack draws, bottom to top.
    seatShareCards(playerId: string, railroadId: RailroadId): StageSpot[]
    // A share deck's face in the strip, while the deck holds a card.
    deckFace(railroadId: RailroadId): StageSpot | undefined
    // A box in map units, on screen.
    mapRect(box: BoundingBox): ScreenRect | undefined
    // The placed piece on a hex, for Undo and history to fade.
    boardPiece(spaceId: SpaceId): Hideable | undefined
}

// A hand piece's moving copy is drawn this much wider than its disc (HandPiece's viewBox).
export const PIECE_EXTENT = 1.2

// The supplied share face is 675 × 1050.
const SHARE_ASPECT = 675 / 1050

function centredBox(rect: ScreenRect, scale: number): ScreenRect {
    const width = rect.width * scale
    const height = rect.height * scale
    return {
        left: rect.left + (rect.width - width) / 2,
        top: rect.top + (rect.height - height) / 2,
        width,
        height
    }
}

function screenRect(element: Element): ScreenRect | undefined {
    const { left, top, width, height } = element.getBoundingClientRect()
    return width > 0 && height > 0 ? { left, top, width, height } : undefined
}

// A box of this size centred on the rectangle.
function boxAt(rect: ScreenRect, width: number, height: number): ScreenRect {
    return {
        left: rect.left + (rect.width - width) / 2,
        top: rect.top + (rect.height - height) / 2,
        width,
        height
    }
}

// Within the window: the phone's side column, scrolled aside, is off screen.
function onScreen(rect: ScreenRect, view: Window | null): boolean {
    if (!view) return true
    return (
        rect.left + rect.width > 0 &&
        rect.top + rect.height > 0 &&
        rect.left < view.innerWidth &&
        rect.top < view.innerHeight
    )
}

// Where the slot at `index` stands among the shown ones, or would stand past the last.
function slotAt(slots: ScreenRect[], index: number, gap: number): ScreenRect | undefined {
    const shown = slots.at(Math.min(index, slots.length - 1))
    if (!shown) return undefined
    const beyond = Math.max(0, index - (slots.length - 1))
    const last = slots.at(-1)
    const before = slots.at(-2)
    const pitch = last && before ? last.left - before.left : shown.width + gap
    return { ...shown, left: shown.left + beyond * pitch }
}

function isStyled(element: Element): element is HTMLElement | SVGElement {
    return element instanceof HTMLElement || element instanceof SVGElement
}

// The stage read from the document: the layer's root is the full-screen dialog while it is open,
// so only what is shown inside it counts.
export class DomFlightStage implements FlightStage {
    constructor(
        private root: ParentNode,
        private flights: Pick<Flights, 'isHidden'>
    ) {}

    private shown(selector: string): (HTMLElement | SVGElement)[] {
        return [...this.root.querySelectorAll(selector)].filter(
            (element): element is HTMLElement | SVGElement =>
                isStyled(element) && !this.flights.isHidden(element)
        )
    }

    // A piece's spot is its disc's box widened to the hand piece's extent.
    private pieceSpot(element: HTMLElement | SVGElement): StageSpot | undefined {
        const disc = element.querySelector('[data-piece-disc]') ?? element
        const rect = screenRect(disc)
        return rect && { element, rect: centredBox(rect, PIECE_EXTENT) }
    }

    private firstSpot(
        elements: (HTMLElement | SVGElement)[],
        spot: (element: HTMLElement | SVGElement) => StageSpot | undefined
    ): StageSpot | undefined {
        for (const element of elements) {
            const found = spot(element)
            if (found) return found
        }
        return undefined
    }

    turnPiece(railroadId: RailroadId) {
        return this.firstSpot(
            this.shown(`[data-your-hand] [data-turn-piece="${railroadId}"] [data-turn-piece-art]`),
            (element) => this.pieceSpot(element)
        )
    }

    handSlot(index: number): ScreenRect | undefined {
        const slots = this.shown('[data-your-hand] [data-hand-slot]').flatMap((slot) => {
            const spot = this.pieceSpot(slot)
            return spot ? [spot.rect] : []
        })
        return slotAt(slots, index, 0)
    }

    // A ledger row's part, while the row is on screen.
    private ledgerRect(playerId: string, selector: string): ScreenRect | undefined {
        const part = this.shown(
            `[data-seat-ledger] [data-ledger-row="${playerId}"] ${selector}`
        ).at(0)
        const rect = part && screenRect(part)
        return rect && onScreen(rect, part.ownerDocument.defaultView) ? rect : undefined
    }

    seatRowPiece(playerId: string): ScreenRect | undefined {
        const name = this.ledgerRect(playerId, '[data-ledger-seat]')
        if (!name) return undefined
        const size = name.height
        return { left: name.left, top: name.top, width: size, height: size }
    }

    seatShareCell(playerId: string, railroadId: RailroadId): ScreenRect | undefined {
        const cell = this.ledgerRect(playerId, `[data-ledger-share="${railroadId}"]`)
        if (!cell) return undefined
        return boxAt(cell, cell.height * SHARE_ASPECT, cell.height)
    }

    seatPiece(playerId: string, railroadId: RailroadId | undefined) {
        const face = railroadId ?? 'hidden'
        return this.firstSpot(
            this.shown(`[data-seat-card="${playerId}"] [data-hand-piece="${face}"]`),
            (element) => this.pieceSpot(element)
        )
    }

    private handOf(playerId: string): HTMLElement | SVGElement | undefined {
        return this.shown(`[data-seat-card="${playerId}"] [data-hand-perspective]`).find(
            (element) => screenRect(element) !== undefined
        )
    }

    seatHandPieces(playerId: string) {
        const hand = this.handOf(playerId)
        if (!hand) return []
        return [...hand.querySelectorAll(':scope > [data-hand-piece]')].flatMap((element) => {
            const spot = isStyled(element) ? this.pieceSpot(element) : undefined
            return spot ? [spot] : []
        })
    }

    seatHandSlot(playerId: string, index: number): ScreenRect | undefined {
        const hand = this.handOf(playerId)
        const handRect = hand && screenRect(hand)
        if (!hand || !handRect) return undefined
        const pieces = [...hand.querySelectorAll(':scope > [data-hand-piece]')].flatMap(
            (element) => {
                const rect = screenRect(element)
                return rect ? [rect] : []
            }
        )
        const gap = Number.parseFloat(getComputedStyle(hand).columnGap) || 0
        const shown = slotAt(pieces, index, gap)
        if (shown) return shown
        const size = Number(hand.dataset.pieceSize) || handRect.height
        return {
            left: handRect.left + index * (size + gap),
            top: handRect.top + (handRect.height - size) / 2,
            width: size,
            height: size
        }
    }

    seatShareCards(playerId: string, railroadId: RailroadId) {
        const stacks = this.shown(
            `[data-seat-card="${playerId}"] [data-seat-share="${railroadId}"]`
        )
        const stack = stacks.find((element) => screenRect(element) !== undefined)
        if (!stack) return []
        return [...stack.querySelectorAll('img')].flatMap((element) => {
            const rect = screenRect(element)
            return rect && !this.flights.isHidden(element) ? [{ element, rect }] : []
        })
    }

    deckFace(railroadId: RailroadId) {
        const face = this.shown(`svg.board [data-share-deck="${railroadId}"] image`).at(0)
        const rect = face && screenRect(face)
        return face && rect ? { element: face, rect } : undefined
    }

    mapRect(box: BoundingBox): ScreenRect | undefined {
        const board = this.shown('svg.board').at(0)
        const rect = board && screenRect(board)
        if (!rect) return undefined
        // The drawn board starts at the strip's left edge, left of the map's x = 0.
        const scale = rect.width / BOARD_BOUNDS.width
        return {
            left: rect.left + (box.x - BOARD_BOUNDS.x) * scale,
            top: rect.top + (box.y - BOARD_BOUNDS.y) * scale,
            width: box.width * scale,
            height: box.height * scale
        }
    }

    boardPiece(spaceId: SpaceId) {
        return this.shown(`svg.board [data-track-piece][data-space-id="${spaceId}"] > .motion`).at(
            0
        )
    }
}
