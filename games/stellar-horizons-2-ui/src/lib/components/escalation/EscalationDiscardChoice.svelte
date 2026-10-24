<script lang="ts">
    import type { EscalationMarker } from '@tabletop/stellar-horizons-2'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import EscalationChip from './EscalationChip.svelte'

    let { drawn }: { drawn: readonly EscalationMarker[] } = $props()
    const gameSession = getGameSession()
</script>

<p class="hint">
    Military Academy draws you one escalation marker more. Choose one of those drawn to discard.
</p>
<div class="row">
    {#each drawn as marker, index (index)}
        <button type="button" class="discard" onclick={() => gameSession.discardEscalation(marker)}>
            <EscalationChip {marker} />
            <span>Discard</span>
        </button>
    {/each}
</div>

<style>
    .row {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
    }

    .discard {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 4px;
    }
</style>
