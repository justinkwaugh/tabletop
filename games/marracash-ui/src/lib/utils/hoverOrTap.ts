export type HoverOrTapHandlers = {
    hover: (active: boolean) => void
    tap: () => void
}

const ActivationKeys = ['Enter', ' ']

// Hover shows a highlight while a mouse or pen is over the element; a finger has
// no hover, so a touch tap toggles it instead, judged per tap so touchscreen
// laptops work with either input.
export function hoverOrTap(node: HTMLElement, handlers: HoverOrTapHandlers) {
    let current = handlers
    let lastPointerType = 'mouse'

    const noteDown = (event: PointerEvent) => {
        lastPointerType = event.pointerType
    }
    const enter = (event: PointerEvent) => {
        if (event.pointerType !== 'touch') current.hover(true)
    }
    const leave = (event: PointerEvent) => {
        if (event.pointerType !== 'touch') current.hover(false)
    }
    const click = () => {
        if (lastPointerType === 'touch') current.tap()
    }
    const key = (event: KeyboardEvent) => {
        if (!ActivationKeys.includes(event.key)) return
        event.preventDefault()
        current.tap()
    }

    node.addEventListener('pointerdown', noteDown)
    node.addEventListener('pointerenter', enter)
    node.addEventListener('pointerleave', leave)
    node.addEventListener('click', click)
    node.addEventListener('keydown', key)

    return {
        update(next: HoverOrTapHandlers) {
            current = next
        },
        destroy() {
            node.removeEventListener('pointerdown', noteDown)
            node.removeEventListener('pointerenter', enter)
            node.removeEventListener('pointerleave', leave)
            node.removeEventListener('click', click)
            node.removeEventListener('keydown', key)
        }
    }
}
