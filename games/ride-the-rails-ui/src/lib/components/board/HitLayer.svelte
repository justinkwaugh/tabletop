<script lang="ts">
    import { USA_HEXES, type HexId } from '@tabletop/ride-the-rails'
    import type { Attachment } from 'svelte/attachments'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { hexPoints } from '$lib/utils/boardGeometry.js'
    import type { LitHexView } from '$lib/utils/pickMarks.js'

    let { views }: { views: readonly LitHexView[] } = $props()

    const gameSession = getGameSession()

    const HEXES = USA_HEXES.map((hex) => ({ hexId: hex.id, points: hexPoints(hex.id) }))
    const labels: ReadonlyMap<HexId, string> = $derived(
        new Map(views.map((view) => [view.hexId, view.label]))
    )

    function hexIdOf(target: EventTarget | null): HexId | undefined {
        if (!(target instanceof Element)) return undefined
        const id = target.closest('[data-hex-id]')?.getAttribute('data-hex-id')
        return USA_HEXES.find((hex) => hex.id === id)?.id
    }

    // U-1, U-5: one listener for every hex; the whole hex is the hit target.
    const pressOnClick: Attachment<SVGGElement> = (group) => {
        const press = (event: MouseEvent) => {
            const hexId = hexIdOf(event.target)
            if (hexId) void gameSession.pressHex(hexId)
        }
        group.addEventListener('click', press)
        return () => group.removeEventListener('click', press)
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
            ></polygon>
        {/if}
    {/each}
</g>

<style>
    .hit {
        cursor: pointer;
    }
    .hit.lit:focus {
        outline: none;
    }
    .hit.lit:focus-visible {
        stroke: var(--rtr-ink);
    }
</style>
