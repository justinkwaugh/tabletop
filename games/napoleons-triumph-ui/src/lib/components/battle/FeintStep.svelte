<script lang="ts">
    import { FeintEnd } from '@tabletop/napoleons-triumph'
    import type { FeintStage } from '$lib/model/battleStage.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import AttackerPicker from './AttackerPicker.svelte'

    let { stage, folded = false }: { stage: FeintStage; folded?: boolean } = $props()

    const gameSession = getGameSession()

    const END_NAMES: Record<FeintEnd, string> = {
        [FeintEnd.Approach]: 'Feint, moving up to the approach',
        [FeintEnd.Reserve]: 'Feint, staying in reserve'
    }
</script>

{#if stage.feinting}
    <div class="nt-battle-prompt">
        {#if stage.canPress}
            A feint.
        {:else}
            The defence stands, and an attack by road must then be a feint.
        {/if}
        {#if folded}
            Tap the pieces that make it on the map, then say where they end.
        {:else}
            Name the pieces that make it, then say where they end.
        {/if}
        {#if stage.canPress}
            Undo goes back to pressing the attack.
        {/if}
    </div>
    <AttackerPicker {stage} {folded} />
    <div class="flex flex-wrap gap-2 pt-1">
        {#each stage.ends as end (end)}
            <button type="button" class="nt-plain-button" onclick={() => gameSession.feint(end)}
                >{stage.ends.length === 1 ? 'Feint in place' : END_NAMES[end]}</button
            >
        {:else}
            <button type="button" class="nt-plain-button" disabled>Feint</button>
        {/each}
    </div>
{:else}
    <div class="nt-battle-prompt">
        {#if stage.pressShowsLeaders}
            The defence stands and has named its leading units. Press the attack, and they are shown
            to you; or call it a feint.
        {:else}
            The defence stands. Press the attack, and the defender names the leading units before
            you declare it; or call it a feint.
        {/if}
    </div>
    <div class="flex flex-wrap gap-2 pt-1">
        <button type="button" class="nt-plain-button" onclick={() => gameSession.pressAttack()}
            >Press the attack</button
        >
        <button type="button" class="nt-plain-button" onclick={() => gameSession.callFeint()}
            >Call it a feint</button
        >
    </div>
{/if}
