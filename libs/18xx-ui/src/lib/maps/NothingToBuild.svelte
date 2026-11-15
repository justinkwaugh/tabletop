<script lang="ts">
    import type { EighteenXXSessionView } from '../session/eighteenXXSession.svelte.js'
    let { session }: { session: EighteenXXSessionView } = $props()
    const companyId = $derived(session.gameState.trackStep?.companyId)
</script>

{#if companyId}
    <header class="nothing-to-build centered-panel">
        <span>{session.companyName(companyId)} can't lay track or place a station</span>
        <button
            class="action-button inline-action"
            disabled={!session.operatingMode.canFinish}
            onclick={() => session.operatingMode.finish()}>finish</button
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
    button {
        margin: 0;
        cursor: pointer;
    }
    button:focus-visible {
        outline: 2px solid #a87948;
        outline-offset: 2px;
    }
    button:disabled {
        opacity: 0.45;
        cursor: default;
    }
</style>
