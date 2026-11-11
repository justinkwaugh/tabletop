import type { Attachment } from 'svelte/attachments'
import { on } from 'svelte/events'
import type { Banner, Region } from '@tabletop/oath'

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

// Listened to with Svelte's `on`, as an `onfocusout` attribute is: a focused row that leaves the page gets
// its `focusout` while Svelte is still removing it, and `on` runs the handler outside that update.
export function pointsAt(target: MenuPointerTarget | undefined): Attachment<EventTarget> {
    return (node) => {
        if (!target) return
        const point = () => menuPointer.point(target)
        const leave = () => menuPointer.leave(target)
        const listeners = [
            on(node, 'pointerenter', point),
            on(node, 'pointerleave', leave),
            on(node, 'focusin', point),
            on(node, 'focusout', leave)
        ]
        return () => {
            leave()
            for (const off of listeners) off()
        }
    }
}
