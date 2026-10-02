import type { Attachment } from 'svelte/attachments'
import type { Banner, Region } from '@tabletop/oath'

/** What a menu row names on the table, so the table can light it while the row is pointed at. */
export type MenuPointerTarget =
    | { kind: 'site'; slotId: string }
    | { kind: 'card'; cardId: string }
    | { kind: 'relic'; slotId: string }
    | { kind: 'deck' }
    | { kind: 'pile'; region: Region }
    | { kind: 'banner'; banner: Banner }

function same(a: MenuPointerTarget | null, b: MenuPointerTarget): boolean {
    return a !== null && JSON.stringify(a) === JSON.stringify(b)
}

// One value per tab, as the card preview is: one pointer, and it never enters game state.
class MenuPointerState {
    private target = $state<MenuPointerTarget | null>(null)

    is(target: MenuPointerTarget): boolean {
        return same(this.target, target)
    }

    point(target: MenuPointerTarget): void {
        this.target = target
    }

    leave(target: MenuPointerTarget): void {
        if (same(this.target, target)) this.target = null
    }
}

export const menuPointer = new MenuPointerState()

/** A row's hover or keyboard focus points at its target; leaving, blurring or unmounting lets go. */
export function pointsAt(target: MenuPointerTarget | undefined): Attachment<EventTarget> {
    return (node) => {
        if (!target) return
        const point = () => menuPointer.point(target)
        const leave = () => menuPointer.leave(target)
        node.addEventListener('pointerenter', point)
        node.addEventListener('pointerleave', leave)
        node.addEventListener('focusin', point)
        node.addEventListener('focusout', leave)
        return () => {
            leave()
            node.removeEventListener('pointerenter', point)
            node.removeEventListener('pointerleave', leave)
            node.removeEventListener('focusin', point)
            node.removeEventListener('focusout', leave)
        }
    }
}
