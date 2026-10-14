<script lang="ts">
    import { AttackWidth } from '$lib/model/battleSelection.js'
    import type { DeclarationStage } from '$lib/model/battleStage.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import SlidingSwitch from '$lib/components/SlidingSwitch.svelte'
    import AttackerPicker from './AttackerPicker.svelte'
    import Force from './Force.svelte'
    import ResultRule from './ResultRule.svelte'

    let { stage }: { stage: DeclarationStage } = $props()

    const gameSession = getGameSession()

    const widths = $derived([
        { value: AttackWidth.Wide, name: 'Wide' },
        { value: AttackWidth.Narrow, name: 'Narrow', unavailable: stage.firesAsAPair }
    ])
</script>

<div class="nt-battle-prompt">
    Declare the attack{stage.startsFromThreat
        ? ': the pieces that made the threat are named to start with'
        : ''}. Tap a piece, here or on the map, to attack with it, again to lead, and once more to
    leave it out.
</div>
<AttackerPicker {stage} />
{#if stage.approachWide}
    <div class="nt-battle-faint pt-1">Attack width</div>
{/if}
<div class="flex flex-wrap items-center gap-2">
    {#if stage.approachWide}
        <SlidingSwitch
            label="Attack width"
            choices={widths}
            chosen={stage.wide ? AttackWidth.Wide : AttackWidth.Narrow}
            onchoose={(width) => gameSession.chooseAttackWidth(width)}
        />
    {/if}
</div>
{#if stage.targetOptions.length > 0}
    <div class="nt-battle-faint pt-1">
        A narrow attack strikes one leading unit: tap it, here or on the map
    </div>
    <Force
        units={stage.targetOptions.map((id) => gameSession.gameState.unit(id))}
        selected={stage.target ? [stage.target] : []}
        markers={Object.fromEntries(
            stage.targetOptions.map((id) => [id, id === stage.target ? 'struck' : 'passed by'])
        )}
        onpick={(id) => gameSession.pickBattleUnit(id)}
    />
{/if}
{#if !stage.problem && stage.initialResult !== undefined}
    <ResultRule initialResult={stage.initialResult} />
{/if}
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
    {/if}
</div>
