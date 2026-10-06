import { gsap } from 'gsap'
import type { Point } from '@tabletop/common'
import type { MoveResult, ShopId } from '@tabletop/marracash'
import { QueueMargin, shopRect, ShopTileInset } from '$lib/utils/boardGeometry.js'
import { shopEarnings } from '$lib/utils/shopEarnings.js'

export type EarningsPopup = { id: string; shopId: ShopId; playerId: string; amount: number } & Point

const StackSpacing = 50
const InitialScale = 0.2
const OvershootScale = 1.16
const PopSeconds = 0.09
const SettleSeconds = 0.08
const SitSeconds = 0.9
const RiseSeconds = 0.3
const RisePixels = 28
// The owner's income is the move's main result, so the mover's cut follows it in
const MoverLagSeconds = 0.15
const StillSeconds = PopSeconds + SettleSeconds + SitSeconds + RiseSeconds

// Popups play on the move's own timeline, so the new state, and the action panel that changes
// with it, publishes only once the last popup has gone.
export class EarningsPopups {
    popups: EarningsPopup[] = $state([])

    private nodes = new Map<string, gsap.TweenTarget>()

    setNode(id: string, node: gsap.TweenTarget | undefined) {
        if (node) this.nodes.set(id, node)
        else this.nodes.delete(id)
    }

    prepare(actionId: string, result: MoveResult, moverId: string) {
        this.popups = result.entries.flatMap((entry) => {
            const rect = shopRect(entry.shopId, ShopTileInset)
            const earnings = shopEarnings(entry, moverId)
            const top = rect.y + rect.height / 2 - ((earnings.length - 1) * StackSpacing) / 2
            return earnings.map((earning, index) => ({
                id: `${actionId}-${entry.shopId}-${earning.playerId}`,
                shopId: entry.shopId,
                playerId: earning.playerId,
                amount: earning.amount,
                x: QueueMargin + rect.x + rect.width / 2,
                y: QueueMargin + top + index * StackSpacing
            }))
        })
    }

    schedule(shopId: ShopId, timeline: gsap.core.Timeline, enteredAt: number) {
        const shopPopups = this.popups.filter((candidate) => candidate.shopId === shopId)
        shopPopups.forEach((popup, order) => {
            const node = this.nodes.get(popup.id)
            if (!node) return
            const start = enteredAt + order * MoverLagSeconds
            gsap.set(node, { xPercent: -50, yPercent: -50, scale: InitialScale, opacity: 0, y: 0 })
            timeline.to(
                node,
                { scale: OvershootScale, opacity: 1, duration: PopSeconds, ease: 'back.out(2.2)' },
                start
            )
            timeline.to(
                node,
                { scale: 1, duration: SettleSeconds, ease: 'power2.out' },
                start + PopSeconds
            )
            timeline.to(
                node,
                { y: -RisePixels, opacity: 0, duration: RiseSeconds, ease: 'power1.out' },
                start + PopSeconds + SettleSeconds + SitSeconds
            )
        })
    }

    // Reduced motion: every popup shows at once, without moving, for as long as it would sit
    scheduleStill(timeline: gsap.core.Timeline, at: number) {
        for (const popup of this.popups) {
            const node = this.nodes.get(popup.id)
            if (!node) continue
            gsap.set(node, { xPercent: -50, yPercent: -50, scale: 1, opacity: 0, y: 0 })
            timeline.set(node, { opacity: 1 }, at)
            timeline.set(node, { opacity: 0 }, at + StillSeconds)
        }
    }

    clear() {
        this.popups = []
    }
}
