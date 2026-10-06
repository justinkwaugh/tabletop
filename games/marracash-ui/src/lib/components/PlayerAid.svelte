<script lang="ts">
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import TurnAid from '$lib/components/TurnAid.svelte'
    import MoneyAid from '$lib/components/MoneyAid.svelte'
    import AntiqueAid from '$lib/components/AntiqueAid.svelte'

    const gameSession = getGameSession()
</script>

<svelte:window onkeydown={(event) => event.key === 'Escape' && gameSession.closePlayerAid()} />

<div
    class="absolute inset-0 z-40 flex overflow-auto p-3"
    role="presentation"
    onclick={() => gameSession.closePlayerAid()}
>
    <div
        class="m-auto flex max-w-full flex-wrap items-start justify-center gap-3.5"
        role="dialog"
        aria-label="Player aid"
        tabindex="-1"
        onclick={(event) => event.stopPropagation()}
        onkeydown={(event) => event.stopPropagation()}
    >
        <TurnAid />
        <MoneyAid />
        {#if gameSession.gameState.antiqueCards}
            <AntiqueAid />
        {/if}
    </div>
</div>
