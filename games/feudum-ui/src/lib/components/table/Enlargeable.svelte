<script lang="ts">
    import { onDestroy, type Snippet } from 'svelte'
    import type { EnlargedFace } from '$lib/model/tableLayers.svelte.js'
    import { getTableLayers } from './tableLayersContext.js'

    /**
     * Contract, Card preview: a press on a card, writ, tile or bead enlarges it, here on the board's
     * SVG (`tag` "g") or in a panel (`tag` "div"). `face` reads the owner's current props, so a back
     * enlarges as a back. `off` while the same press would pick (a lit space under a tile), or where
     * no table holds it, it is the plain piece.
     */
    let {
        face,
        label,
        tag = 'g',
        off = false,
        children
    }: {
        face: () => EnlargedFace
        label: string
        tag?: 'g' | 'div'
        off?: boolean
        children: Snippet
    } = $props()

    const layers = getTableLayers()
    const owner = {}

    function enlarge(event: Event) {
        event.stopPropagation()
        layers?.enlarge(owner, face)
    }

    function onKey(event: KeyboardEvent) {
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            enlarge(event)
        }
    }

    onDestroy(() => {
        layers?.ownerGone(owner)
    })
</script>

{#if !layers || off}
    {@render children()}
{:else if tag === 'g'}
    <g
        role="button"
        tabindex="0"
        aria-label="Enlarge {label}"
        pointer-events="all"
        cursor="zoom-in"
        data-enlarge={label}
        onclick={enlarge}
        onkeydown={onKey}
    >
        {@render children()}
    </g>
{:else}
    <div
        role="button"
        tabindex="0"
        aria-label="Enlarge {label}"
        class="cursor-zoom-in"
        data-enlarge={label}
        onclick={enlarge}
        onkeydown={onKey}
    >
        {@render children()}
    </div>
{/if}
