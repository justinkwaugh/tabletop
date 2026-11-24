import { tick } from 'svelte'
import type { GameAction } from '@tabletop/common'
import type { AnimationContext } from '@tabletop/frontend-components'
import {
    SaleOutcome,
    isShip,
    type HydratedLwGameState,
    type LocomotiveSpace
} from '@tabletop/locomotive-werks'
import type { LwGameSession } from '$lib/model/session.svelte.js'
import {
    BOX,
    CUSTOMER_BASE_X,
    ROW_HEIGHT,
    existingOrderBox,
    rowTop
} from '$lib/utils/boardLayout.js'

const SLIDE = 0.32
const FLIP = 0.14
// Undo and history steps without their action stay within the 200ms fallback budget. Stepping
// forward slides for QUICK_SLIDE, and a reduced die finishes its flip half as long again after.
const QUICK = 0.18
const QUICK_SLIDE = 0.12

export function orderDieId(locomotiveId: string, slot: number): string {
    return `lw-order-${locomotiveId}-${slot}`
}

type Change = {
    to: HydratedLwGameState
    from?: HydratedLwGameState
    action?: GameAction
    animationContext: AnimationContext
}

// One order die a sale changed: it moved to the Customer Base or was reduced in place.
type SaleMark = { row: number; slot: number; locomotiveId: string; moved: boolean }

// The sale-shaped changes from one state to the next: a die leaving Existing Orders as the
// Customer Base gains one, or a single face changing in place.
function saleMarks(before: HydratedLwGameState, after: HydratedLwGameState): SaleMark[] {
    return before.spaces.flatMap((space, row): SaleMark[] => {
        const next = after.spaces[row]
        const slot = firstDifference(space, next)
        if (slot < 0) {
            return []
        }
        const moved =
            next.customerBase.length === space.customerBase.length + 1 &&
            next.existingOrders.length === space.existingOrders.length - 1
        const reduced =
            next.customerBase.length === space.customerBase.length &&
            next.existingOrders.length === space.existingOrders.length &&
            space.existingOrders.filter((face, index) => face !== next.existingOrders[index])
                .length === 1
        return moved || reduced ? [{ row, slot, locomotiveId: space.locomotiveId, moved }] : []
    })
}

function firstDifference(space: LocomotiveSpace, next: LocomotiveSpace): number {
    return space.existingOrders.findIndex((face, index) => face !== next.existingOrders[index])
}

export type ShipmentDiceHost = Pick<
    LwGameSession,
    'gameState' | 'showBoardStep' | 'addGameStateChangeListener' | 'removeGameStateChangeListener'
>

// The board SVG, where each order die is found by its id.
export type DiceBoard = { querySelector(selectors: string): object | null }

// Shows what each shipment did to its order die: a reduced die flips to its new face, and a filled
// or exceeded die slides into the Customer Base. Undo and history steps without their action make
// the same motion quickly, in reverse when stepping back.
export class ShipmentDiceAnimator {
    private readonly listener = (change: Change) => this.onGameStateChange(change)

    constructor(
        private readonly session: ShipmentDiceHost,
        private readonly board: DiceBoard
    ) {}

    register() {
        this.session.addGameStateChangeListener(this.listener)
    }

    unregister() {
        this.session.removeGameStateChangeListener(this.listener)
    }

    private async onGameStateChange({ from, to, action, animationContext }: Change) {
        if (!from) {
            return
        }
        if (action) {
            if (isShip(action)) {
                await this.ship(from, to, action, animationContext)
            }
            return
        }
        if (to.actionCount < from.actionCount) {
            await this.unship(to, saleMarks(to, from), animationContext)
        } else {
            await this.slide(from, to, saleMarks(from, to), QUICK_SLIDE, animationContext)
        }
    }

    private async ship(
        from: HydratedLwGameState,
        to: HydratedLwGameState,
        action: GameAction,
        animationContext: AnimationContext
    ) {
        const shipments = isShip(action) ? (action.metadata?.shipments ?? []) : []
        const marks = shipments.flatMap((shipment): SaleMark[] => {
            const row = from.spaces.findIndex(
                (space) => space.locomotiveId === shipment.locomotiveId
            )
            const slot = from.spaces[row]?.existingOrders.indexOf(shipment.face) ?? -1
            return slot < 0
                ? []
                : [
                      {
                          row,
                          slot,
                          locomotiveId: shipment.locomotiveId,
                          moved: shipment.outcome !== SaleOutcome.Reduced
                      }
                  ]
        })
        await this.slide(from, to, marks, SLIDE, animationContext)
    }

    // Draws `from`, moves each die over `duration`, then hands the board to `to`.
    private async slide(
        from: HydratedLwGameState,
        to: HydratedLwGameState,
        marks: SaleMark[],
        duration: number,
        animationContext: AnimationContext
    ) {
        if (marks.length === 0) {
            return
        }
        const shown = this.session.gameState
        this.showStep(shown, from)
        await tick()
        const timeline = animationContext.actionTimeline
        const flip = Math.min(FLIP, duration / 2)
        for (const mark of marks) {
            const die = this.die(mark)
            if (!die) {
                continue
            }
            const x = existingOrderBox(mark.slot) + BOX / 2
            if (mark.moved) {
                timeline.to(die, { x: CUSTOMER_BASE_X + BOX / 2 - x, duration }, 0)
                timeline.set(die, { x: 0 }, duration)
            } else {
                const svgOrigin = `${x} ${rowTop(mark.row) + ROW_HEIGHT / 2}`
                timeline.to(die, { scaleY: 0, svgOrigin, duration: flip }, duration - flip)
                timeline.to(die, { scaleY: 1, svgOrigin, duration: flip }, duration)
            }
        }
        timeline.call(() => this.showStep(shown, to), [], duration)
    }

    // Stepping back over a sale: draws `to` and brings each die back from where the sale left it.
    private async unship(to: HydratedLwGameState, marks: SaleMark[], context: AnimationContext) {
        if (marks.length === 0) {
            return
        }
        const shown = this.session.gameState
        this.showStep(shown, to)
        await tick()
        const timeline = context.actionTimeline
        for (const mark of marks) {
            const die = this.die(mark)
            if (!die) {
                continue
            }
            const x = existingOrderBox(mark.slot) + BOX / 2
            if (mark.moved) {
                const travel = CUSTOMER_BASE_X + BOX / 2 - x
                timeline.fromTo(die, { x: travel }, { x: 0, duration: QUICK }, 0)
            } else {
                const svgOrigin = `${x} ${rowTop(mark.row) + ROW_HEIGHT / 2}`
                timeline.fromTo(die, { scaleY: 0, svgOrigin }, { scaleY: 1, duration: QUICK }, 0)
            }
        }
    }

    private die(mark: SaleMark): object | null {
        return this.board.querySelector(`#${orderDieId(mark.locomotiveId, mark.slot)}`)
    }

    // A state shown or switched to since the transition began owns the board; a late step from an
    // earlier transition must not draw over it.
    private showStep(shown: HydratedLwGameState, state: HydratedLwGameState) {
        if (this.session.gameState === shown) {
            this.session.showBoardStep(state)
        }
    }
}
