import type { BoundingBox } from '@tabletop/common'
import type { RailroadId, SpaceId } from '@tabletop/promontory-point'
import { MAP_SIZE } from '$lib/utils/boardGeometry.js'
import type { Flights, Hideable, ScreenRect } from './flights.svelte.js'

// A thing on the table where a flight starts or ends: its element and where it is on screen.
export type StageSpot = { element: Hideable; rect: ScreenRect }

// Where the table's things are on screen now, read when an action's flights are planned. Every
// answer is for an element shown in the flight layer's root (the full-screen dialog while it is
// open) and not already hidden by a flight; undefined when there is none.
export interface FlightStage {
    // The action panel's hand piece of this railroad, the deciding seat's own.
    turnPiece(railroadId: RailroadId): StageSpot | undefined
    // A seat card's hand piece: of this railroad face up, or concealed when undefined.
    seatPiece(playerId: string, railroadId: RailroadId | undefined): StageSpot | undefined
    // Every hand piece a seat card shows, in order (the kept piece apart).
    seatHandPieces(playerId: string): StageSpot[]
    // Where the hand piece at `index` stands, or would stand, in a seat card.
    seatHandSlot(playerId: string, index: number): ScreenRect | undefined
    // The share cards a seat card's stack draws, bottom to top.
    seatShareCards(playerId: string, railroadId: RailroadId): StageSpot[]
    // A share deck's face in the sea, while the deck holds a card.
    deckFace(railroadId: RailroadId): StageSpot | undefined
    // A box in map units, on screen.
    mapRect(box: BoundingBox): ScreenRect | undefined
    // The placed piece on a hex, for Undo and history to fade.
    boardPiece(spaceId: SpaceId): Hideable | undefined
}

// A hand piece's moving copy is drawn this much wider than its disc (HandPiece's viewBox).
export const PIECE_EXTENT = 1.2

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
        return this.firstSpot(this.shown(`[data-turn-piece="${railroadId}"] svg`), (element) =>
            this.pieceSpot(element)
        )
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
        const shown = pieces.at(Math.min(index, pieces.length - 1))
        if (shown) {
            const beyond = Math.max(0, index - (pieces.length - 1))
            return { ...shown, left: shown.left + beyond * (shown.width + gap) }
        }
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
        const scale = rect.width / MAP_SIZE.width
        return {
            left: rect.left + box.x * scale,
            top: rect.top + box.y * scale,
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
