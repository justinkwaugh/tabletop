<script lang="ts">
    import type { Middleware, Placement } from '@floating-ui/dom'
    import * as dom from '@floating-ui/dom'
    import type { Snippet } from 'svelte'
    import { sineIn } from 'svelte/easing'
    import { fade } from 'svelte/transition'

    const DEFAULT_OFFSET = 8

    let {
        reference,
        placement = 'top',
        offset = DEFAULT_OFFSET,
        strategy = 'absolute',
        middlewares = [
            dom.flip({ altBoundary: true }),
            dom.shift({ altBoundary: true }),
            dom.hide({ elementContext: 'reference' })
        ],
        isOpen = $bindable(false),
        trigger = 'auto',
        onClose,
        children,
        ...restProps
    }: {
        reference: string
        placement?: Placement
        offset?: number
        strategy?: 'absolute' | 'fixed'
        middlewares?: Middleware[]
        isOpen?: boolean
        trigger?: 'auto' | 'manual'
        onClose?: () => void
        children: Snippet
    } = $props()

    let popover: HTMLElement | null = $state(null)
    let referenceElement: HTMLElement | null = null

    $effect(() => {
        if (reference && popover) {
            referenceElement = popover.ownerDocument.querySelector<HTMLElement>(reference)
            popover.showPopover()
        }
    })

    let middleware: Middleware[] = $derived.by(() => {
        const base = [...middlewares, dom.offset(offset)]
        return base
    })

    const px = (n: number | undefined) => (n ? `${n}px` : '')

    function updatePopoverPosition() {
        if (!referenceElement || !popover) {
            return
        }

        return dom
            .computePosition(referenceElement, popover, { placement, middleware, strategy })
            .then(({ x, y, middlewareData: { hide }, placement: pl, strategy }) => {
                // console.log('to ', { x, y, pl, strategy })
                if (popover) {
                    Object.assign(popover.style, {
                        position: strategy,
                        left: px(x),
                        right: 'auto',
                        top: px(y)
                    })

                    if (hide?.referenceHidden) {
                        popover.hidden = true
                    } else {
                        popover.hidden = false
                    }
                }
            })
    }

    $effect(() => {
        // Floating UI instance when it's closed we need to keep a autoUpdate destroy function
        let autoUpdateDestroy: (() => void) | null = null

        if (popover && referenceElement) {
            autoUpdateDestroy = dom.autoUpdate(referenceElement, popover, updatePopoverPosition)
        }

        return () => {
            autoUpdateDestroy?.()
            autoUpdateDestroy = null
        }
    })

    function onToggle(event: ToggleEvent) {
        event.stopPropagation()
        if (event.newState === 'closed') {
            if (onClose) {
                onClose()
            }
        }
    }

    export function toggle() {
        if (popover) {
            popover.togglePopover()
        }
    }
</script>

<div
    class="bg-transparent"
    popover={trigger}
    role="tooltip"
    bind:this={popover}
    transition:fade={{ duration: 100, easing: sineIn }}
    ontoggle={onToggle}
    {...restProps}
>
    {@render children()}
</div>
