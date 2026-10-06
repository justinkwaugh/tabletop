import { tick } from 'svelte'
import { prefersReducedMotion } from 'svelte/motion'
import { gsap } from 'gsap'
import { assertExists, type Point } from '@tabletop/common'
import type { AnimationContext, GameStateChangeListener } from '@tabletop/frontend-components'
import {
    getFountain,
    getShop,
    isMoveVisitors,
    routeFrom,
    shopsNextTo,
    type FountainId,
    type HydratedMarracashGameState,
    type MarketColor,
    type MoveResult,
    type Route,
    type ShopId
} from '@tabletop/marracash'
import type { MarracashGameSession } from '$lib/model/session.svelte.js'
import { cellCenter, distance, shopRect, ShopTileInset } from '$lib/utils/boardGeometry.js'
import { fountainPawnPositions } from '$lib/utils/fountainPawns.js'
import { shopBranch } from '$lib/utils/routePreview.js'
import { EarningsPopups } from '$lib/animators/earningsPopups.svelte.js'

const WalkPixelsPerSecond = 240
const WalkSpacing = 35
const LeadInSeconds = 0.15
const ShopEntrySeconds = 0.15
// A large crowd walks faster, all at one speed, so no move outlasts this.
const MaxWalkSeconds = 3
// Undo and state-only history must settle within the shared 200ms fallback budget.
export const DirectSeconds = 0.2
const InShopScale = 0.3

export type VisitorWalker = { id: string; color: MarketColor }

type WalkPlan = { walker: VisitorWalker; points: Point[]; shopId?: ShopId }

type Place = { point: Point; color: MarketColor; inShop: boolean }

type Trip = { walker: VisitorWalker; from: Place; to: Place }

type GameStateChange = Parameters<GameStateChangeListener<HydratedMarracashGameState>>[0]

export type VisitorAnimationHost = Pick<
    MarracashGameSession,
    | 'movingVisitors'
    | 'fountainVisitorOverrides'
    | 'shopCustomerOverrides'
    | 'addGameStateChangeListener'
    | 'removeGameStateChangeListener'
>

export class VisitorMoveAnimator {
    private elements = new Map<string, gsap.TweenTarget>()
    private nextTripId = 0
    private readonly listener = (change: GameStateChange) => this.onGameStateChange(change)

    constructor(
        private gameSession: VisitorAnimationHost,
        readonly earnings = new EarningsPopups()
    ) {}

    register() {
        this.gameSession.addGameStateChangeListener(this.listener)
    }

    unregister() {
        this.gameSession.removeGameStateChangeListener(this.listener)
        this.elements.clear()
        this.earnings.clear()
    }

    setElement(id: string, element: gsap.TweenTarget | undefined) {
        if (element) this.elements.set(id, element)
        else this.elements.delete(id)
    }

    private async onGameStateChange({ from, to, action, animationContext }: GameStateChange) {
        if (!from) return
        if (!action) {
            this.earnings.clear()
            await this.animateDirect(from, to, animationContext)
        } else if (isMoveVisitors(action) && prefersReducedMotion.current) {
            if (action.metadata) this.earnings.prepare(action.id, action.metadata, action.playerId)
            await this.animateDirect(from, to, animationContext)
            await tick()
            this.earnings.scheduleStill(animationContext.actionTimeline, DirectSeconds)
            animationContext.afterAnimations(() => this.earnings.clear())
        } else if (isMoveVisitors(action) && action.metadata) {
            const route = routeFrom(action.fountainId, action.direction)
            assertExists(route, `No route leaves fountain ${action.fountainId} ${action.direction}`)
            this.earnings.prepare(action.id, action.metadata, action.playerId)
            await this.animateWalk(action.id, route, action.metadata, from, animationContext)
        }
    }

    private async animateWalk(
        actionId: string,
        route: Route,
        result: MoveResult,
        from: HydratedMarracashGameState,
        animationContext: AnimationContext
    ) {
        const plans = this.walkPlans(actionId, route, result, from)
        await this.mountWalkers(
            plans.map((plan) => plan.walker),
            animationContext
        )

        const timeline = animationContext.actionTimeline
        const origin = from.getFountainState(route.from).visitors
        const arrived = [...from.getFountainState(route.to).visitors]
        const customers = new Map(
            result.entries.map((entry) => [entry.shopId, from.getShopState(entry.shopId).customers])
        )

        const lastEntries = new Map<ShopId, number>()
        const departures = evenlySpacedDepartures(plans)
        const lineLengths = plans.map((plan, order) => departures[order] + this.pathLength(plan))
        const speed = Math.max(
            WalkPixelsPerSecond,
            Math.max(...lineLengths) / (MaxWalkSeconds - LeadInSeconds - ShopEntrySeconds)
        )
        plans.forEach((plan, order) => {
            const element = this.walkerElement(plan.walker)
            const start = LeadInSeconds + departures[order] / speed

            this.place(element, plan.points[0], 1)
            timeline.set(element, { opacity: 1 }, start)
            timeline.call(
                () => this.showFountain(route.from, origin.slice(0, origin.length - order - 1)),
                undefined,
                start
            )

            let at = start
            for (let leg = 1; leg < plan.points.length; leg++) {
                const duration = distance(plan.points[leg - 1], plan.points[leg]) / speed
                const { x, y } = plan.points[leg]
                timeline.to(element, { x, y, duration, ease: 'none' }, at)
                at += duration
            }

            const shopId = plan.shopId
            if (shopId === undefined) {
                timeline.call(
                    () => {
                        arrived.push(plan.walker.color)
                        this.showFountain(route.to, [...arrived])
                    },
                    undefined,
                    at
                )
                timeline.set(element, { opacity: 0 }, at)
                return
            }
            timeline.to(
                element,
                { scale: InShopScale, opacity: 0, duration: ShopEntrySeconds, ease: 'power1.in' },
                at
            )
            timeline.call(
                () => {
                    const count = (customers.get(shopId) ?? 0) + 1
                    customers.set(shopId, count)
                    this.showShop(shopId, count)
                },
                undefined,
                at + ShopEntrySeconds
            )
            lastEntries.set(shopId, Math.max(lastEntries.get(shopId) ?? 0, at + ShopEntrySeconds))
        })
        for (const [shopId, enteredAt] of lastEntries) {
            this.earnings.schedule(shopId, timeline, enteredAt)
        }
        animationContext.afterAnimations(() => this.earnings.clear())
    }

    // Pawns leave from the back, so the crowd left behind is the front of the visitor list.
    private walkPlans(
        actionId: string,
        route: Route,
        result: MoveResult,
        from: HydratedMarracashGameState
    ): WalkPlan[] {
        const origin = from.getFountainState(route.from).visitors
        const originCenter = cellCenter(getFountain(route.from).coords)
        const destinationCenter = cellCenter(getFountain(route.to).coords)
        let destinationCount = from.getFountainState(route.to).visitors.length
        const shopByColor = new Map(
            result.entries.map((entry) => [getShop(entry.shopId).color, entry.shopId])
        )

        return origin.toReversed().map((color, order) => {
            const remaining = origin.length - order
            const start = fountainPawnPositions(remaining, originCenter)[remaining - 1]
            const walker = { id: `${actionId}-${order}`, color }
            const shopId = shopByColor.get(color)
            if (shopId !== undefined) {
                const step = route.path.findIndex((coords) => shopsNextTo(coords).includes(shopId))
                const [, doorway] = shopBranch(route, shopId)
                const walkway = route.path.slice(0, step + 1).map(cellCenter)
                return { walker, shopId, points: [start, ...walkway, doorway] }
            }
            destinationCount += 1
            const spot = fountainPawnPositions(destinationCount, destinationCenter)[
                destinationCount - 1
            ]
            const walkway = route.path.slice(0, -1).map(cellCenter)
            return { walker, points: [start, ...walkway, spot] }
        })
    }

    private async animateDirect(
        from: HydratedMarracashGameState,
        to: HydratedMarracashGameState,
        animationContext: AnimationContext
    ) {
        const departures: Place[] = []
        const arrivals: Place[] = []
        const atStart: (() => void)[] = []
        const atEnd: (() => void)[] = []

        for (const { fountainId, visitors: before } of from.fountains) {
            const after = to.getFountainState(fountainId).visitors
            const center = cellCenter(getFountain(fountainId).coords)
            const leaving = this.surplusIndices(before, after)
            const joining = this.surplusIndices(after, before)
            const beforeSpots = fountainPawnPositions(before.length, center)
            const afterSpots = fountainPawnPositions(after.length, center)
            for (const index of leaving) {
                departures.push({ point: beforeSpots[index], color: before[index], inShop: false })
            }
            for (const index of joining) {
                arrivals.push({ point: afterSpots[index], color: after[index], inShop: false })
            }
            if (leaving.length > 0) {
                const staying = before.filter((_, index) => !leaving.includes(index))
                atStart.push(() => this.showFountain(fountainId, staying))
            }
            if (joining.length > 0) {
                atEnd.push(() => this.showFountain(fountainId, [...after]))
            }
        }

        for (const { shopId, customers: before } of from.shops) {
            const after = to.getShopState(shopId).customers
            if (after === before) continue
            const rect = shopRect(shopId, ShopTileInset)
            const place: Place = {
                point: { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 },
                color: getShop(shopId).color,
                inShop: true
            }
            const places = Array.from({ length: Math.abs(after - before) }, () => place)
            const show = () => this.showShop(shopId, after)
            if (after < before) {
                departures.push(...places)
                atStart.push(show)
            } else {
                arrivals.push(...places)
                atEnd.push(show)
            }
        }

        const trips = this.pairByColor(departures, arrivals)
        if (trips.length === 0) return
        await this.mountWalkers(
            trips.map((trip) => trip.walker),
            animationContext
        )

        const timeline = animationContext.actionTimeline
        timeline.call(() => atStart.forEach((show) => show()), undefined, 0)
        for (const trip of trips) {
            const element = this.walkerElement(trip.walker)
            this.place(element, trip.from.point, trip.from.inShop ? InShopScale : 1)
            timeline.set(element, { opacity: 1 }, 0)
            timeline.to(
                element,
                {
                    x: trip.to.point.x,
                    y: trip.to.point.y,
                    scale: trip.to.inShop ? InShopScale : 1,
                    duration: DirectSeconds,
                    ease: 'power1.inOut'
                },
                0
            )
            timeline.set(element, { opacity: 0 }, DirectSeconds)
        }
        timeline.call(() => atEnd.forEach((show) => show()), undefined, DirectSeconds)
    }

    private pairByColor(departures: Place[], arrivals: Place[]): Trip[] {
        const unclaimed = [...arrivals]
        return departures.flatMap((departure) => {
            const index = unclaimed.findIndex((arrival) => arrival.color === departure.color)
            if (index < 0) return []
            const walker = { id: `trip-${this.nextTripId++}`, color: departure.color }
            return [{ walker, from: departure, to: unclaimed.splice(index, 1)[0] }]
        })
    }

    // Indices in `crowd` beyond the visitors of each colour that `other` also has.
    private surplusIndices(crowd: readonly MarketColor[], other: readonly MarketColor[]): number[] {
        const unmatched = new Map<MarketColor, number>()
        for (const color of other) unmatched.set(color, (unmatched.get(color) ?? 0) + 1)
        const surplus: number[] = []
        crowd.forEach((color, index) => {
            const available = unmatched.get(color) ?? 0
            if (available > 0) unmatched.set(color, available - 1)
            else surplus.push(index)
        })
        return surplus
    }

    private async mountWalkers(walkers: VisitorWalker[], animationContext: AnimationContext) {
        this.gameSession.movingVisitors = walkers
        animationContext.afterAnimations(() => {
            this.gameSession.movingVisitors = []
        })
        await tick()
    }

    private walkerElement(walker: VisitorWalker): gsap.TweenTarget {
        const element = this.elements.get(walker.id)
        assertExists(element, `Visitor ${walker.id} never mounted`)
        return element
    }

    private place(element: gsap.TweenTarget, point: Point, scale: number) {
        gsap.set(element, {
            x: point.x,
            y: point.y,
            scale,
            opacity: 0,
            transformOrigin: 'center center'
        })
    }

    private pathLength(plan: WalkPlan): number {
        return plan.points
            .slice(1)
            .reduce((total, point, leg) => total + distance(plan.points[leg], point), 0)
    }

    private showFountain(fountainId: FountainId, visitors: MarketColor[]) {
        this.gameSession.fountainVisitorOverrides[fountainId] = visitors
    }

    private showShop(shopId: ShopId, customers: number) {
        this.gameSession.shopCustomerOverrides[shopId] = customers
    }
}

// Crowd spots sit at different distances from the walkway, so pawns set off at staggered
// offsets to reach it one spacing apart.
function evenlySpacedDepartures(plans: readonly WalkPlan[]): number[] {
    const firstLegs = plans.map((plan) => distance(plan.points[0], plan.points[1]))
    const longestFirstLeg = Math.max(...firstLegs)
    const departures: number[] = []
    firstLegs.forEach((firstLeg, order) => {
        const offset = longestFirstLeg - firstLeg + order * WalkSpacing
        departures.push(Math.max(departures.at(-1) ?? 0, offset))
    })
    return departures
}

export function animateWalker(
    node: SVGElement,
    params: { animator: VisitorMoveAnimator; id: string }
) {
    params.animator.setElement(params.id, node)
    return {
        destroy() {
            params.animator.setElement(params.id, undefined)
        }
    }
}
