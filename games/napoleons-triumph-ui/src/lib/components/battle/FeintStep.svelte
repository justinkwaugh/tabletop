<script lang="ts">
    import { FeintEnd } from '@tabletop/napoleons-triumph'
    import type { FeintStage } from '$lib/model/battleStage.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import AttackerPicker from './AttackerPicker.svelte'

    let { stage }: { stage: FeintStage } = $props()

    const gameSession = getGameSession()

    const END_NAMES: Record<FeintEnd, string> = {
        [FeintEnd.Approach]: 'Feint, moving up to the approach',
        [FeintEnd.Reserve]: 'Feint, staying in reserve'
    }
</script>

<div class="nt-battle-prompt">
    The defence stands. Press the attack to see its leading units, or call it a feint with the units
    you pick.
</div>
<AttackerPicker {stage} />
<div class="flex flex-wrap gap-2 pt-1">
    {#if stage.canPress}
        <button type="button" class="nt-plain-button" onclick={() => gameSession.pressAttack()}
            >Press the attack</button
        >
    {/if}
    {#each stage.ends as end (end)}
        <button type="button" class="nt-plain-button" onclick={() => gameSession.feint(end)}
            >{stage.ends.length === 1 ? 'Feint in place' : END_NAMES[end]}</button
        >
    {:else}
        <button type="button" class="nt-plain-button" disabled>Feint</button>
    {/each}
</div>
