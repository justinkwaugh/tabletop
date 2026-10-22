<script lang="ts">
    import type { EighteenFortySixSession } from './session.svelte.js'
    let { session }: { session: EighteenFortySixSession } = $props()
    const companyId = $derived(session.gameState.trackStep?.companyId)
</script>

{#if companyId}
    <header class="nothing-to-build midwest-panel centered-panel">
        <span>{session.companyName(companyId)} can't lay track or place a station</span>
        <button
            class="action-button inline-action"
            disabled={!session.canChooseAction}
            onclick={() => session.finishConstruction()}>finish</button
        >
    </header>
{/if}

<style>
    .nothing-to-build {
        display: flex;
        align-items: center;
        justify-content: center;
        flex-wrap: wrap;
        gap: 6px;
        margin: 4px 0;
        font-size: 13px;
    }
    .nothing-to-build button {
        margin: 0;
    }
</style>
