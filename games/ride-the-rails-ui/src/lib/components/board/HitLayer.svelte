<script lang="ts">
    import { cityById, type HexId } from '@tabletop/ride-the-rails'
    import type { Attachment } from 'svelte/attachments'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { hexPoints } from '$lib/utils/boardGeometry.js'
    import { hexIdOf } from '$lib/utils/hexElements.js'
    import type { LitHexView } from '$lib/utils/pickMarks.js'

    let { views }: { views: readonly LitHexView[] } = $props()

    const gameSession = getGameSession()

    // Displayed Game State: the shown state's map, each hex one target round all its cells.
    const HEXES = $derived(
        gameSession.boardFrame.hexIds.map((hexId) => ({ hexId, points: hexPoints(hexId) }))
    )
    const labels: ReadonlyMap<HexId, string> = $derived(
        new Map(views.map((view) => [view.hexId, view.label]))
    )
    // The cities a journey's route reaches: unlit, but a press on one cuts the route back to it, so
    // they are kept clear as the lit hexes are (Contract, Pick conventions).
    const routeHexIds: ReadonlySet<HexId> = $derived(
        new Set(
            gameSession.journeyDraft?.draftLinks.map((link) => cityById(link.cityId).hexId) ?? []
        )
    )

    /** The longest a browser takes from lifting a finger to the click it sends for the tap. */
    const TAP_TO_CLICK_MS = 1000

    type Touch = { x: number; y: number; at: number }

    // U-1, U-5: one listener for every hex; the whole hex is the hit target. A browser may move a
    // tap's click onto a nearby button (a lit hex) when the finger lands beside it, so a press by
    // touch or pen goes to the hex under the point where it lifted, and only a press with no hex
    // there (beyond the map's edge) keeps the browser's target.
    const pressOnClick: Attachment<SVGGElement> = (group) => {
        const document = group.ownerDocument
        let lastTouch: Touch | undefined
        const noteLift = (event: PointerEvent) => {
            lastTouch =
                event.pointerType === 'mouse'
                    ? undefined
                    : { x: event.clientX, y: event.clientY, at: event.timeStamp }
        }
        const hexUnder = (touch: Touch | undefined): HexId | undefined => {
            if (!touch) return undefined
            const element = document.elementFromPoint(touch.x, touch.y)
            return element && group.contains(element) ? hexIdOf(element) : undefined
        }
        const press = (event: MouseEvent) => {
            const touch =
                lastTouch && event.timeStamp - lastTouch.at < TAP_TO_CLICK_MS
                    ? lastTouch
                    : undefined
            lastTouch = undefined
            const hexId = hexUnder(touch) ?? hexIdOf(event.target)
            if (hexId) void gameSession.pressHex(hexId)
        }
        // Capture on the document, as the board's pan may hold the pointer while the finger is down.
        document.addEventListener('pointerup', noteLift, { capture: true })
        group.addEventListener('click', press)
        return () => {
            document.removeEventListener('pointerup', noteLift, { capture: true })
            group.removeEventListener('click', press)
        }
    }

    function pressOnKey(event: KeyboardEvent, hexId: HexId) {
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            void gameSession.pressHex(hexId)
        }
    }
</script>

<!-- Lit hexes are buttons in map order (the Tab order), named by place and effect. -->
<g class="hits" {@attach pressOnClick}>
    {#each HEXES as hex (hex.hexId)}
        {@const label = labels.get(hex.hexId)}
        {#if label}
            <polygon
                points={hex.points}
                data-hex-id={hex.hexId}
                role="button"
                tabindex="0"
                aria-label={label}
                class="hit lit"
                data-keep-clear
                fill="transparent"
                stroke="transparent"
                stroke-width="5"
                onkeydown={(event) => pressOnKey(event, hex.hexId)}
            ></polygon>
        {:else}
            <polygon
                points={hex.points}
                data-hex-id={hex.hexId}
                class="hit"
                fill="transparent"
                aria-hidden="true"
                data-keep-clear={routeHexIds.has(hex.hexId) ? '' : undefined}
            ></polygon>
        {/if}
    {/each}
</g>

<style>
    /* Only a hex's own area takes presses; a lit hex's focus stroke does not reach its neighbours. */
    .hit {
        cursor: pointer;
        pointer-events: fill;
    }
    .hit.lit:focus {
        outline: none;
    }
    .hit.lit:focus-visible {
        stroke: var(--rtr-ink);
    }
</style>
