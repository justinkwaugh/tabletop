<script lang="ts">
    import { draftCompany } from '@tabletop/1846'
    import type { EighteenFortySixSession } from './session.svelte.js'
    let { session }: { session: EighteenFortySixSession } = $props()
    const pending = $derived(session.gameState.pendingRevenueMarker)
</script>

{#if pending}
    <header class="marker-prompt">
        <span>Choose a hex for {draftCompany(pending.privateCompanyId).name} or</span>
        <button
            class="action-button inline-action"
            disabled={!session.canAssignRevenueMarker}
            onclick={() => session.assignRevenueMarker(pending.privateCompanyId)}>skip</button
        >
    </header>
{/if}

<style>
    .marker-prompt {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 6px;
        margin: 4px 0;
        font-size: 13px;
    }
    .marker-prompt button {
        margin: 0;
    }
</style>
