import { getContext, setContext, tick } from 'svelte'
import { prefersReducedMotion } from 'svelte/motion'
import { gsap } from 'gsap'
import type { GameStateChangeListener } from '@tabletop/frontend-components'
import {
    getShop,
    isStartAuction,
    type HydratedMarracashGameState,
    type MarketColor,
    type ShopId
} from '@tabletop/marracash'
import type { MarracashGameSession } from '$lib/model/session.svelte.js'

type GameStateChange = Parameters<GameStateChangeListener<HydratedMarracashGameState>>[0]

export type AuctionNoticeHost = Pick<
    MarracashGameSession,
    'addGameStateChangeListener' | 'removeGameStateChangeListener' | 'myPlayer'
>

export type AuctionNoticePart = 'backdrop' | 'card' | 'placard'

export type ShownAuctionNotice = { shopId: ShopId; auctioneerId: string; color: MarketColor }

const EnterSeconds = 0.35
const HoldSeconds = 2.6
const FlightSeconds = 0.65
const FadeSeconds = 0.3

// When another player starts an auction, a large placard announces it over the board, holds, then
// flies down onto the auctioned stall, where the board's own placard takes over as it lands. Only
// a live or fully replayed auction plays it; a reload, Undo or history step shows the board as is.
export class AuctionNoticeAnimator {
    // The notice is on screen from its action until the new state is published.
    shown: ShownAuctionNotice | undefined = $state(undefined)
    private parts = new Map<AuctionNoticePart, HTMLElement>()
    private boardPlacard: SVGElement | undefined
    private readonly listener = (change: GameStateChange) => this.onGameStateChange(change)

    constructor(private gameSession: AuctionNoticeHost) {}

    register() {
        this.gameSession.addGameStateChangeListener(this.listener)
    }

    unregister() {
        this.gameSession.removeGameStateChangeListener(this.listener)
        this.parts.clear()
        this.boardPlacard = undefined
        this.shown = undefined
    }

    setPart(part: AuctionNoticePart, element: HTMLElement | undefined) {
        if (element) this.parts.set(part, element)
        else this.parts.delete(part)
    }

    setBoardPlacard(element: SVGElement | undefined) {
        this.boardPlacard = element
    }

    private async onGameStateChange({ to, action, animationContext }: GameStateChange) {
        if (!action || !isStartAuction(action) || !to.auction) return
        if (action.playerId === this.gameSession.myPlayer?.id) return

        const shopId = to.auction.shopId
        this.shown = { shopId, auctioneerId: action.playerId, color: getShop(shopId).color }
        animationContext.afterAnimations(() => (this.shown = undefined))
        await tick()

        const backdrop = this.parts.get('backdrop')
        const card = this.parts.get('card')
        const placard = this.parts.get('placard')
        if (!backdrop || !card || !placard) return

        // Measured before any tween moves the placard.
        const from = placard.getBoundingClientRect()
        const target = this.boardPlacard?.getBoundingClientRect()

        const timeline = animationContext.actionTimeline
        gsap.set(backdrop, { opacity: 0 })
        gsap.set(card, { opacity: 0, y: 10 })
        gsap.set(placard, { opacity: 0, scale: 0.8, transformOrigin: 'center center' })
        timeline.to(backdrop, { opacity: 1, duration: EnterSeconds * 0.7 }, 0)
        timeline.to(
            placard,
            { opacity: 1, scale: 1, duration: EnterSeconds, ease: 'back.out(1.7)' },
            0
        )
        timeline.to(card, { opacity: 1, y: 0, duration: FadeSeconds }, 0.1)

        const leave = EnterSeconds + HoldSeconds
        timeline.to(card, { opacity: 0, y: 8, duration: FadeSeconds }, leave)
        timeline.to(backdrop, { opacity: 0, duration: FadeSeconds * 1.5 }, leave)
        if (prefersReducedMotion.current || !target || target.width === 0) {
            timeline.to(placard, { opacity: 0, duration: FadeSeconds }, leave)
            return
        }
        timeline.to(
            placard,
            {
                x: target.left + target.width / 2 - (from.left + from.width / 2),
                y: target.top + target.height / 2 - (from.top + from.height / 2),
                scale: target.width / from.width,
                duration: FlightSeconds,
                ease: 'power3.inOut'
            },
            leave
        )
    }
}

const ContextKey = Symbol('marracash-auction-notice')

export function setAuctionNoticeAnimator(animator: AuctionNoticeAnimator) {
    setContext(ContextKey, animator)
}

export function getAuctionNoticeAnimator(): AuctionNoticeAnimator {
    return getContext(ContextKey)
}
