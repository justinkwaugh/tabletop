<script lang="ts">
    import { AttackWidth } from '$lib/model/battleSelection.js'
    import type { DeclarationStage } from '$lib/model/battleStage.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import AttackerPicker from './AttackerPicker.svelte'

    let { stage }: { stage: DeclarationStage } = $props()

    const gameSession = getGameSession()

    const WIDTHS = [
        { width: AttackWidth.Wide, name: 'Wide attack' },
        { width: AttackWidth.Narrow, name: 'Narrow attack' }
    ]
</script>

<div class="nt-battle-prompt">
    Tap units, here or on the map, to attack with them; tap again to lead.
</div>
<AttackerPicker {stage} />
<div class="flex flex-wrap items-center gap-2 pt-1">
    {#if stage.approachWide}
        {#each WIDTHS as option (option.width)}
            {@const chosen = stage.wide === (option.width === AttackWidth.Wide)}
            <button
                type="button"
                class="nt-plain-button nt-battle-small"
                class:nt-chosen={chosen}
                aria-pressed={chosen}
                onclick={() => gameSession.chooseAttackWidth(option.width)}>{option.name}</button
            >
        {/each}
    {/if}
    {#each stage.targetOptions as id, index (id)}
        <button
            type="button"
            class="nt-plain-button nt-battle-small"
            class:nt-chosen={stage.target === id}
            aria-pressed={stage.target === id}
            onclick={() => gameSession.chooseStruckLeader(id)}
            >Strike the {index === 0 ? 'first' : 'second'} leading unit</button
        >
    {/each}
</div>
<div class="flex flex-wrap items-center gap-3 pt-1">
    <button
        type="button"
        class="nt-plain-button"
        disabled={!stage.orders || stage.problem !== undefined}
        onclick={() => gameSession.declareAttack()}
    >
        Attack{stage.leaders.length === 0 ? ' with no leading unit' : ''}
    </button>
    {#if stage.problem}
        <span class="nt-battle-warning">{stage.problem}.</span>
    {:else if stage.initialResult !== undefined}
        <span class="nt-battle-result"
            >Initial result {stage.initialResult > 0 ? '+' : ''}{stage.initialResult}</span
        >
    {/if}
</div>
