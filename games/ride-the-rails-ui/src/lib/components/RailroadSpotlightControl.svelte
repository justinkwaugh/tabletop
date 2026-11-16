<script lang="ts">
    import type { Snippet } from 'svelte'
    import type { RailroadId } from '@tabletop/ride-the-rails'
    import { spotlightHandlers } from '$lib/model/railroadSpotlight.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'

    let {
        railroadId,
        label,
        class: className = '',
        children
    }: { railroadId: RailroadId; label: string; class?: string; children: Snippet } = $props()

    const gameSession = getGameSession()

    const handlers = $derived(spotlightHandlers(gameSession, railroadId))
    const spotlit = $derived(gameSession.spotlightRailroadId === railroadId)
</script>

<button
    type="button"
    class="spotlight-control {className}"
    class:spotlit
    aria-label={label}
    aria-pressed={spotlit}
    onclick={handlers.onclick}
    onpointerenter={handlers.onpointerenter}
    onpointerleave={handlers.onpointerleave}
>
    {@render children()}
</button>

<style>
    .spotlight-control {
        cursor: pointer;
        outline-offset: 1px;
    }

    .spotlit {
        box-shadow: 0 0 0 2px var(--rtr-accent);
    }
</style>
