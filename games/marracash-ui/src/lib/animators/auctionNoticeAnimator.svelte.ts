import { getContext, setContext, tick } from 'svelte'
import { prefersReducedMotion } from 'svelte/motion'
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
    'addGameStateChangeListener' | 'removeGameStateChangeListener'
>

export type AuctionNoticePart = 'backdrop' | 'card' | 'placard'

export type ShownAuctionNotice = { shopId: ShopId; auctioneerId: string; color: MarketColor }

const EnterSeconds = 0.35
const HoldSeconds = 1
const FlightSeconds = 0.65
const FadeSeconds = 0.3

// The notice's look at a moment of its animation. The timeline tweens these values rather than
// any element, so a notice remounted mid-animation, as when the board enters or leaves full
// screen, picks up exactly where its predecessor was.
type NoticeLook = {
    backdrop: number
    card: number
    cardShift: number
    placard: number
    placardScale: number
    // How far the placard has flown from the middle of the board to the auctioned stall.
    flight: number
}

// When an auction starts, a large placard announces it to every player over the board, holds, then
// flies down onto the auctioned stall, where the board's own placard takes over as it lands. Only
// a live or fully replayed auction plays it; a reload, Undo or history step shows the board as is.
// Under reduced motion only opacity changes.
export class AuctionNoticeAnimator {
    // The notice is on screen from its action until the new state is published.
    shown: ShownAuctionNotice | undefined = $state(undefined)
    private parts = new Map<AuctionNoticePart, HTMLElement>()
    private boardPlacard: SVGElement | undefined
    private look: NoticeLook | undefined
    private readonly listener = (change: GameStateChange) => this.onGameStateChange(change)

    constructor(private gameSession: AuctionNoticeHost) {}

    register() {
        this.gameSession.addGameStateChangeListener(this.listener)
    }

    unregister() {
        this.gameSession.removeGameStateChangeListener(this.listener)
        this.parts.clear()
        this.boardPlacard = undefined
        this.look = undefined
        this.shown = undefined
    }

    setPart(part: AuctionNoticePart, element: HTMLElement) {
        this.parts.set(part, element)
        this.render()
    }

    // A remounted notice's part can register before the old one is destroyed, so only the
    // element still registered is forgotten.
    clearPart(part: AuctionNoticePart, element: HTMLElement) {
        if (this.parts.get(part) === element) this.parts.delete(part)
    }

    setBoardPlacard(element: SVGElement | undefined) {
        this.boardPlacard = element
    }

    private async onGameStateChange({ to, action, animationContext }: GameStateChange) {
        if (!action || !isStartAuction(action) || !to.auction) return

        const shopId = to.auction.shopId
        const still = prefersReducedMotion.current
        const look: NoticeLook = {
            backdrop: 0,
            card: 0,
            cardShift: still ? 0 : 10,
            placard: 0,
            placardScale: still ? 1 : 0.8,
            flight: 0
        }
        this.look = look
        this.shown = { shopId, auctioneerId: action.playerId, color: getShop(shopId).color }
        animationContext.afterAnimations(() => {
            this.look = undefined
            this.shown = undefined
        })
        await tick()
        this.render()

        const render = () => this.render()
        const timeline = animationContext.actionTimeline
        timeline.to(look, { backdrop: 1, duration: EnterSeconds * 0.7, onUpdate: render }, 0)
        timeline.to(look, { placard: 1, duration: EnterSeconds * 0.6, onUpdate: render }, 0)
        if (!still) {
            timeline.to(
                look,
                {
                    placardScale: 1,
                    duration: EnterSeconds,
                    ease: 'back.out(1.7)',
                    onUpdate: render
                },
                0
            )
        }
        timeline.to(look, { card: 1, cardShift: 0, duration: FadeSeconds, onUpdate: render }, 0.1)

        const leave = EnterSeconds + HoldSeconds
        timeline.to(
            look,
            { card: 0, cardShift: still ? 0 : 8, duration: FadeSeconds, onUpdate: render },
            leave
        )
        timeline.to(look, { backdrop: 0, duration: FadeSeconds * 1.5, onUpdate: render }, leave)
        timeline.to(
            look,
            still
                ? { placard: 0, duration: FadeSeconds, onUpdate: render }
                : { flight: 1, duration: FlightSeconds, ease: 'power3.inOut', onUpdate: render },
            leave
        )
    }

    // Writes the current look to whichever notice is mounted. The flight is measured afresh each
    // frame from the placard's resting place to the stall's, so it lands in either layout.
    private render() {
        const look = this.look
        if (!look) return
        const backdrop = this.parts.get('backdrop')
        const card = this.parts.get('card')
        const placard = this.parts.get('placard')
        if (backdrop) backdrop.style.opacity = String(look.backdrop)
        if (card) {
            card.style.opacity = String(look.card)
            card.style.transform = `translateY(${look.cardShift}px)`
        }
        if (!placard) return
        let x = 0
        let y = 0
        let scale = look.placardScale
        const rest = placard.parentElement?.getBoundingClientRect()
        const target = this.boardPlacard?.getBoundingClientRect()
        if (look.flight > 0 && rest && target && target.width > 0) {
            x = (target.left + target.width / 2 - (rest.left + rest.width / 2)) * look.flight
            y = (target.top + target.height / 2 - (rest.top + rest.height / 2)) * look.flight
            scale += (target.width / rest.width - scale) * look.flight
        }
        // With no stall to land on, the placard fades as it would leave.
        const opacity =
            look.flight > 0 && !(target && target.width > 0) ? 1 - look.flight : look.placard
        placard.style.opacity = String(opacity)
        placard.style.transform = `translate(${x}px, ${y}px) scale(${scale})`
    }
}

const ContextKey = Symbol('marracash-auction-notice')

export function setAuctionNoticeAnimator(animator: AuctionNoticeAnimator) {
    setContext(ContextKey, animator)
}

export function getAuctionNoticeAnimator(): AuctionNoticeAnimator {
    return getContext(ContextKey)
}
