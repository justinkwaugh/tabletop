import type { Point } from '@tabletop/common'
import { GuildIds, type GuildId } from '@tabletop/feudum'
import { visualClientRect } from '@tabletop/frontend-components'
import { titleRootOf } from '$lib/utils/titleRoot.js'
import type { GuildsApart } from './boardPlan.js'
import type { FlightEnd, SeatPart } from './flightPlan.js'
import { BoardWidth, GuildAreaWidth, guildAreaAt, uprightPoint } from '$lib/utils/boardGeometry.js'

export interface HideableSource {
    readonly style: Pick<CSSStyleDeclaration, 'visibility' | 'removeProperty'>
}

export interface StagePlace extends Point {
    readonly size: number
    readonly source?: HideableSource
}

export interface FlightStage {
    locate(end: FlightEnd): StagePlace
    forget(): void
    /** Contract, Animation plan: where the board draws no score ring, a score flies to its seat. */
    readonly scoresFly?: () => boolean
    /** Contract, Desk layout: the guild areas an open side shows, stood upright over the map. */
    readonly guildsApart?: () => GuildsApart
}

const CopySmallest = 14
const CopyLargest = 56
const StandInSize = 24
const TableShare = 0.3
const TableLargest = 220

/** Relative to the layer: inside the wrapper's dialog, the dialog positions a fixed layer. */
export class DomFlightStage implements FlightStage {
    private readonly found = new Map<FlightEnd, Element | null>()

    constructor(private readonly layer: HTMLElement) {}

    forget() {
        this.found.clear()
    }

    private get table(): ParentNode {
        return titleRootOf(this.layer)
    }

    readonly scoresFly = () =>
        this.table.querySelector('[data-board-surface] [data-score-ring]') === null

    readonly guildsApart = (): GuildsApart =>
        GuildIds.filter((guild) => this.openArea(guild) !== null)

    private openArea(guild: GuildId): Element | null {
        return this.table.querySelector(`[data-open-guild="${guild}"] [data-upright-area]`)
    }

    locate(end: FlightEnd): StagePlace {
        const origin = this.layer.getBoundingClientRect()
        const relative = ({ x, y }: Point) => ({ x: x - origin.left, y: y - origin.top })
        switch (end.kind) {
            case 'board':
                return this.locateOnBoard(end, relative)
            case 'table':
                return {
                    x: origin.width / 2,
                    y: origin.height / 2,
                    size: end.size ?? Math.min(origin.width * TableShare, TableLargest)
                }
            case 'seat':
            case 'offer': {
                const element = this.elementOf(end)
                if (!element) {
                    // No seat on screen (full screen, the history tab): the copy crosses the edge.
                    return {
                        x: origin.width + StandInSize,
                        y: origin.height / 2,
                        size: StandInSize
                    }
                }
                const rect = visualClientRect(element)
                const exact = this.isDrawable(element) && element.matches(this.exactOf(end))
                return {
                    ...relative(this.centreOf(rect)),
                    size: exact
                        ? Math.min(
                              CopyLargest,
                              Math.max(CopySmallest, Math.min(rect.width, rect.height))
                          )
                        : StandInSize,
                    ...(exact && this.isDrawable(element) ? { source: element } : {})
                }
            }
        }
    }

    private exactOf(end: Extract<FlightEnd, { kind: 'seat' | 'offer' }>): string {
        if (end.kind === 'offer') {
            return end.writId ? `[data-writ-offer="${end.writId}"]` : '[data-writ-backs]'
        }
        return this.selectorOf(end.part)
    }

    /** The board's scale from its own rectangle: right under CSS zoom, and whatever frames it. */
    private locateOnBoard(
        end: Extract<FlightEnd, { kind: 'board' }>,
        relative: (point: Point) => Point
    ): StagePlace {
        const guild = guildAreaAt(end.point)
        const area = guild ? this.openArea(guild) : null
        if (guild && area) {
            return this.locateInOpenArea(guild, area, end, relative)
        }
        const surface = this.table.querySelector('[data-board-surface]')
        const piece = end.piece ? surface?.querySelector(`[data-motion="${end.piece}"]`) : undefined
        const rect = surface ? visualClientRect(surface) : undefined
        const drawn =
            surface instanceof SVGSVGElement && surface.viewBox.baseVal.width > 0
                ? surface.viewBox.baseVal
                : { x: 0, y: 0, width: BoardWidth }
        const scale = rect ? rect.width / drawn.width : 1
        const pieceRect = piece ? visualClientRect(piece) : undefined
        const seen = pieceRect && pieceRect.width + pieceRect.height > 0 ? pieceRect : undefined
        const onScreen = seen
            ? this.centreOf(seen)
            : rect
              ? {
                    x: rect.left + (end.point.x - drawn.x) * scale,
                    y: rect.top + (end.point.y - drawn.y) * scale
                }
              : end.point
        const view = surface?.closest('dialog:modal') ?? surface?.closest('[data-board-view]')
        const framed = view ? visualClientRect(view) : undefined
        const kept = framed
            ? {
                  x: Math.min(framed.right, Math.max(framed.left, onScreen.x)),
                  y: Math.min(framed.bottom, Math.max(framed.top, onScreen.y))
              }
            : onScreen
        return {
            ...relative(kept),
            size: Math.max(CopySmallest, end.size * scale),
            ...(end.hide && piece && this.isDrawable(piece) ? { source: piece } : {})
        }
    }

    /** Contract, Desk layout: an end in an open side's guild area stands in the upright area. */
    private locateInOpenArea(
        guild: GuildId,
        area: Element,
        end: Extract<FlightEnd, { kind: 'board' }>,
        relative: (point: Point) => Point
    ): StagePlace {
        const box = visualClientRect(area)
        const piece = end.piece ? area.querySelector(`[data-motion="${end.piece}"]`) : null
        const pieceRect = piece ? visualClientRect(piece) : undefined
        const seen = pieceRect && pieceRect.width + pieceRect.height > 0 ? pieceRect : undefined
        const onScreen = seen ? this.centreOf(seen) : uprightPoint(guild, end.point, box)
        return {
            ...relative(onScreen),
            size: Math.max(CopySmallest, (end.size * box.height) / GuildAreaWidth),
            ...(end.hide && piece && this.isDrawable(piece) ? { source: piece } : {})
        }
    }

    /** R-5.3 The seat's open sheet, then its column; then, a seat out of view, its strip's chip. */
    private elementOf(end: Extract<FlightEnd, { kind: 'seat' | 'offer' }>): Element | null {
        const known = this.found.get(end)
        if (known?.isConnected) {
            return known
        }
        const element = this.search(end)
        this.found.set(end, element)
        return element
    }

    private search(end: Extract<FlightEnd, { kind: 'seat' | 'offer' }>): Element | null {
        const page = this.table
        if (end.kind === 'offer') {
            const cap = page.querySelector(this.exactOf(end))
            if (cap && this.isOnScreen(cap)) {
                return cap
            }
        }
        const part =
            end.kind === 'offer' ? this.selectorOf({ part: 'writs' }) : this.selectorOf(end.part)
        const section =
            end.kind === 'seat' ? this.sectionOf(end.part) : '[data-seat-section="writs"]'
        const roots = [`[data-open-seat="${end.playerId}"]`, `[data-seat-panel="${end.playerId}"]`]
        for (const root of roots) {
            const seat = page.querySelector(root)
            if (!seat) {
                continue
            }
            const candidates = [part, section, '[data-open-seat-of]'].map((selector) =>
                seat.querySelector(selector)
            )
            const shown = [...candidates, seat].find((one) => one && this.isOnScreen(one))
            if (shown) {
                return shown
            }
        }
        const chip = page.querySelector(`[data-seat-chip="${end.playerId}"]`)
        return chip && this.isOnScreen(chip) ? chip : null
    }

    private selectorOf(part: SeatPart): string {
        switch (part.part) {
            case 'good':
                return `[data-supply-good="${part.good}"]`
            case 'barrel':
                return '[data-barrel]'
            case 'pouch':
                return '[data-pouch]'
            case 'shillings':
                return '[data-supply-shillings]'
            case 'markers':
                return '[data-supply-markers]'
            case 'tile':
                return `[data-supply-tile="${part.tileId}"]`
            case 'writ':
                return `[data-writ-face="${part.writId}"]`
            case 'writs':
                return '[data-writ-count]'
            case 'bead':
                return `[data-supply-bead="${part.value}"]`
            case 'seals':
                return '[data-seals]'
            case 'pawns':
                return '[data-open-seat-of]'
            case 'score':
                return '[data-seat-score]'
        }
    }

    private isDrawable(element: Element | null): element is HTMLElement | SVGElement {
        return element instanceof HTMLElement || element instanceof SVGElement
    }

    /** Topmost at its centre, unless inert: elementFromPoint never hits an inert element. */
    private isOnScreen(element: Element): boolean {
        const rect = visualClientRect(element)
        if (rect.width === 0 && rect.height === 0) {
            return false
        }
        const centre = this.centreOf(rect)
        for (let up = element.parentElement; up; up = up.parentElement) {
            const { overflowX, overflowY, display } = getComputedStyle(up)
            if (display === 'none') {
                return false
            }
            const clips = [overflowX, overflowY].some((one) => one !== 'visible')
            if (clips && !this.holds(visualClientRect(up), centre)) {
                return false
            }
        }
        if (element.closest('[inert]')) {
            return true
        }
        const hit = element.ownerDocument.elementFromPoint(centre.x, centre.y)
        const seat =
            element.closest('[data-open-seat], [data-seat-panel], [data-seat-chip]') ?? element
        const root = element.closest('[data-game-ui]')
        return (
            !!hit && (!root || root.contains(hit)) && (seat.contains(hit) || hit.contains(element))
        )
    }

    private sectionOf(part: SeatPart): string {
        switch (part.part) {
            case 'barrel':
                return '[data-seat-section="barrel"]'
            case 'pouch':
                return '[data-seat-section="pouch"]'
            case 'writ':
            case 'writs':
                return '[data-seat-section="writs"]'
            case 'score':
                return '[data-open-seat-of]'
            default:
                return '[data-seat-section="supply"]'
        }
    }

    private centreOf(rect: DOMRect): Point {
        return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }
    }

    private holds(rect: DOMRect, { x, y }: Point): boolean {
        return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom
    }
}
