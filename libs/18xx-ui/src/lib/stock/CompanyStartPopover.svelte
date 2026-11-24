<script lang="ts">
    import type { BoundingBox } from '@tabletop/common'
    import { popoverBeside } from '../presentation/popoverPlacement.js'
    import CompanyStartContent from './CompanyStartContent.svelte'
    import './tradePopover.css'
    import type { EighteenXXSessionView } from '../session/eighteenXXSession.svelte.js'

    let {
        session,
        companyId,
        opener,
        anchor,
        pointerY,
        withinMap,
        onclose
    }: {
        session: EighteenXXSessionView
        companyId: string
        opener: HTMLElement
        anchor: BoundingBox
        pointerY: number
        withinMap: (node: Node) => boolean
        onclose: () => void
    } = $props()

    const starts = $derived(session.cardStarts)
    let size = $state({ width: 0, height: 0 })
    const position = $derived(
        popoverBeside(anchor, pointerY, size, {
            width: window.innerWidth,
            height: window.innerHeight
        })
    )

    // A manual popover, as the map press choosing the company's home must leave it open. An outside
    // press closes it only after its own click has run, so Undo or a stock menu acts on the start
    // first rather than finding it already dropped.
    function openWhileMounted(element: HTMLDivElement) {
        const returnFocusTo = document.activeElement
        const outside = (node: EventTarget | null): node is Node =>
            node instanceof Node && !element.contains(node) && !opener.contains(node)
        let dismissing = false
        const notePress = (event: PointerEvent) => {
            dismissing = outside(event.target) && !(starts.awaitingHome && withinMap(event.target))
        }
        const dismiss = (event: MouseEvent) => {
            if (dismissing && outside(event.target)) onclose()
            dismissing = false
        }
        const escape = (event: KeyboardEvent) => {
            if (event.key !== 'Escape' || event.defaultPrevented || otherLayerOpen(element)) return
            onclose()
        }
        element.showPopover()
        element.focus()
        document.addEventListener('pointerdown', notePress, true)
        document.addEventListener('click', dismiss)
        document.addEventListener('keydown', escape)
        return () => {
            document.removeEventListener('pointerdown', notePress, true)
            document.removeEventListener('click', dismiss)
            document.removeEventListener('keydown', escape)
            const focus = document.activeElement
            if (
                returnFocusTo instanceof HTMLElement &&
                (!focus || focus === document.body || element.contains(focus))
            )
                returnFocusTo.focus({ preventScroll: true })
        }
    }
    function otherLayerOpen(element: HTMLElement): boolean {
        return [...document.querySelectorAll(':modal, :popover-open')].some(
            (layer) => layer !== element
        )
    }
</script>

<div
    class="company-start trade-popover"
    popover="manual"
    role="dialog"
    tabindex="-1"
    aria-label={`Start ${session.companyName(companyId)}`}
    bind:offsetWidth={size.width}
    bind:offsetHeight={size.height}
    style:left={`${position.x}px`}
    style:top={`${position.y}px`}
    {@attach openWhileMounted}
>
    <CompanyStartContent {session} {companyId} />
</div>

<style>
    .company-start {
        max-width: min(360px, calc(100vw - 16px));
    }
    .company-start:focus {
        outline: none;
    }
</style>
