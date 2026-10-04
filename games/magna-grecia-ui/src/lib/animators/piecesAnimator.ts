import type { GameAction } from '@tabletop/common'
import type { AnimationContext } from '@tabletop/frontend-components'
import { ActionType, type HydratedMagnaGreciaGameState } from '@tabletop/magna-grecia'
import { tick } from 'svelte'
import type { Attachment } from 'svelte/attachments'
import {
    MARKET_BASE,
    SOLD_MARK_CENTER,
    marketBody,
    marketTop,
    type MarketState
} from '$lib/components/board/MarketArt.svelte'
import {
    blendLooks,
    oracleDrop,
    oracleLook,
    oracleRotation,
    oracleTone
} from '$lib/components/board/OracleArt.svelte'
import type { MarketView, OracleView, RoadView } from '$lib/utils/boardView.js'
import { hasPieceChanges, pieceChanges, type Change } from '$lib/utils/pieceChanges.js'

export type PieceArrivals = { roads: RoadView[]; markets: MarketView[] }

type PiecesCallbacks = {
    colorOf: (playerId: string) => string
    // Presence only: mounts pieces of the `to` board before the state swap, and marks the
    // pieces as moving while any of them does.
    showArrivals: (arrivals: PieceArrivals) => void
    clearArrivals: () => void
}

type PieceKind = 'road' | 'market' | 'oracle'

// Seconds into an action when its consequences (oracles turning, markets waking or going quiet)
// start: once a city tile has poured in, or a road has dropped in.
function consequenceStart(action?: GameAction): number {
    switch (action?.type) {
        case ActionType.PlaceCity:
            return 0.45
        case ActionType.PlaceRoad:
            return 0.2
        default:
            return 0
    }
}

const ACTION = {
    roadDrop: 0.24,
    marketRise: 0.45,
    marketShift: 0.35,
    marketLeave: 0.3,
    soldStamp: 0.3,
    oracleTurn: 0.65
}
// Undo and history steps: every path ends within 200ms.
const FAST = {
    roadDrop: 0.15,
    marketRise: 0.16,
    marketShift: 0.16,
    marketLeave: 0.15,
    soldStamp: 0.15,
    oracleTurn: 0.18
}

// Roads drop in, markets rise out of the ground (or sink, or take their sold X), and oracles turn
// to the city they now favour. Motion is written straight to the registered SVG nodes.
export class PiecesAnimator {
    private elements = new Map<string, Element>()

    constructor(private callbacks: PiecesCallbacks) {}

    attach(kind: PieceKind, key: string): Attachment {
        const id = `${kind}:${key}`
        return (node) => {
            this.elements.set(id, node)
            return () => {
                if (this.elements.get(id) === node) {
                    this.elements.delete(id)
                }
            }
        }
    }

    async onGameStateChange({
        from,
        to,
        action,
        animationContext
    }: {
        from?: HydratedMagnaGreciaGameState
        to: HydratedMagnaGreciaGameState
        action?: GameAction
        animationContext: AnimationContext
    }) {
        if (!from) {
            return
        }
        const changes = pieceChanges(from.board, to.board)
        if (!hasPieceChanges(changes)) {
            return
        }
        this.callbacks.showArrivals({
            roads: changes.arrivingRoads,
            markets: changes.arrivingMarkets
        })
        animationContext.afterAnimations(() => this.callbacks.clearArrivals())
        await tick()

        const timing = action ? ACTION : FAST
        const after = action ? consequenceStart(action) : 0
        const timeline = animationContext.actionTimeline
        const play = (at: number, duration: number, ease: string, draw: (p: number) => void) => {
            const clock = { p: 0 }
            draw(0)
            timeline.to(clock, { p: 1, duration, ease, onUpdate: () => draw(clock.p) }, at)
        }

        for (const road of changes.arrivingRoads) {
            const node = this.elements.get(`road:${road.key}`)
            if (!node) continue
            const { x, y } = road.center
            play(0, timing.roadDrop, 'back.out(2)', (p) => {
                node.setAttribute('transform', `translate(${x} ${y}) scale(${1.25 - 0.25 * p})`)
                node.setAttribute('opacity', `${Math.min(1, p * 2.5)}`)
            })
        }
        for (const road of changes.leavingRoads) {
            const node = this.elements.get(`road:${road.key}`)
            if (!node) continue
            play(0, timing.roadDrop, 'power2.in', (p) => node.setAttribute('opacity', `${1 - p}`))
        }

        for (const market of changes.arrivingMarkets) {
            const node = this.elements.get(`market:${market.key}`)
            if (!node) continue
            // A founding market comes with its city tile, so it waits for the tile to settle.
            const top = marketTop(marketState(market))
            play(after, timing.marketRise, action ? 'back.out(1.6)' : 'power2.out', (p) => {
                setMarketTop(node, MARKET_BASE + (top - MARKET_BASE) * p)
                node.setAttribute('opacity', `${Math.min(1, p * 6)}`)
            })
        }
        for (const market of changes.leavingMarkets) {
            const node = this.elements.get(`market:${market.key}`)
            if (!node) continue
            const top = marketTop(marketState(market))
            play(0, timing.marketLeave, 'power2.in', (p) => {
                setMarketTop(node, top + (MARKET_BASE - top) * p)
                node.setAttribute('opacity', `${1 - p * p}`)
            })
        }
        for (const change of changes.changedMarkets) {
            this.shiftMarket(change, timing, action ? after : 0, play)
        }

        for (const change of changes.turnedOracles) {
            const node = this.elements.get(`oracle:${change.to.key}`)
            if (!node) continue
            this.turnOracle(node, change, timing.oracleTurn, after, play)
        }
    }

    private shiftMarket(
        { from, to }: Change<MarketView>,
        timing: typeof ACTION,
        after: number,
        play: (at: number, duration: number, ease: string, draw: (p: number) => void) => void
    ) {
        const node = this.elements.get(`market:${to.key}`)
        if (!node) return
        const fromTop = marketTop(marketState(from))
        const toTop = marketTop(marketState(to))
        if (fromTop !== toTop) {
            const rising = toTop < fromTop
            play(after, timing.marketShift, rising ? 'back.out(1.8)' : 'power2.inOut', (p) =>
                setMarketTop(node, fromTop + (toTop - fromTop) * p)
            )
        }
        if (from.sold !== to.sold) {
            const mark = node.querySelector('[data-part="sold-mark"]')
            if (!mark) return
            const { x, y } = SOLD_MARK_CENTER
            const stamping = to.sold
            // Selling stamps the X on at once: it is the action itself, not a consequence.
            play(0, timing.soldStamp, stamping ? 'back.out(2.4)' : 'power2.in', (p) => {
                const shown = stamping ? p : 1 - p
                const scale = stamping ? 1.8 - 0.8 * p : 1
                mark.setAttribute(
                    'transform',
                    `translate(${x} ${y}) scale(${scale}) translate(${-x} ${-y})`
                )
                mark.setAttribute('opacity', `${Math.min(1, Math.max(0, shown * 1.5))}`)
            })
        }
    }

    private turnOracle(
        node: Element,
        { from, to }: Change<OracleView>,
        duration: number,
        after: number,
        play: (at: number, duration: number, ease: string, draw: (p: number) => void) => void
    ) {
        const turn = node.querySelector('[data-part="turn"]')
        const tones = [...node.querySelectorAll<SVGElement>('[data-tone]')]
        const drops = [...node.querySelectorAll('[data-part="drop"], [data-part="drop-edge"]')]
        // A round (unfavoured) precinct has no direction, so it takes the other end's.
        const fromAngle = from.attention?.angle ?? to.attention?.angle ?? -90
        const toAngle = to.attention?.angle ?? fromAngle
        const fromRotation = oracleRotation(fromAngle)
        // The short way round.
        const sweep = ((((oracleRotation(toAngle) - fromRotation) % 360) + 540) % 360) - 180
        const colorOf = (view: OracleView) =>
            view.attention && this.callbacks.colorOf(view.attention.playerId)
        const fromLook = oracleLook(colorOf(from))
        const toLook = oracleLook(colorOf(to))
        const fromReach = from.attention ? 1 : 0
        const toReach = to.attention ? 1 : 0
        play(after, duration, 'power2.inOut', (p) => {
            turn?.setAttribute('transform', `rotate(${fromRotation + sweep * p})`)
            const look = blendLooks(fromLook, toLook, p)
            for (const element of tones) {
                element.setAttribute(
                    element.dataset.toneAttr ?? 'fill',
                    oracleTone(look, element.dataset.tone ?? '')
                )
            }
            if (fromReach !== toReach) {
                // The tail points out to the hex edge as favour arrives, and back as it goes.
                const reach = fromReach + (toReach - fromReach) * p
                const shape = oracleDrop(reach)
                for (const drop of drops) drop.setAttribute('d', shape)
            }
        })
    }
}

function marketState(market: MarketView): MarketState {
    return market.sold ? 'sold' : market.active ? 'active' : 'inactive'
}

function setMarketTop(node: Element, top: number) {
    node.querySelector('[data-part="body"]')?.setAttribute('d', marketBody(top))
    for (const ellipse of node.querySelectorAll('[data-part="top"]')) {
        ellipse.setAttribute('cy', `${top}`)
    }
}
