<script lang="ts">
    import { attackerLeadsInitially, counterAttackStrength, type Side } from '@tabletop/napoleons-triumph'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import Force from './Force.svelte'

    let { side }: { side: Side } = $props()

    const gameSession = getGameSession()
    const game = $derived(gameSession.gameState)
    const attack = $derived(gameSession.attack)
    const stage = $derived(gameSession.battleStage)
    const candidates = $derived(stage?.candidates ?? [])
    const picked = $derived(stage?.picked ?? [])
    const losing = $derived(attack?.initialResult !== undefined && attackerLeadsInitially(game))
    const preview = $derived.by(() => {
        if (attack?.initialResult === undefined) {
            return undefined
        }
        const faces = picked.flatMap((id) => game.unit(id).face ?? [])
        return attack.initialResult - counterAttackStrength(faces)
    })
</script>

<div class="nt-battle-prompt">
    {losing ? 'The attack is winning.' : 'The defence is holding.'} Up to two units may
    counter-attack; each loses a step first. Infantry may only when the attack is winning.
</div>
<Force
    {side}
    units={candidates}
    selected={picked}
    markers={stage?.roles}
    onpick={(id) => gameSession.pickBattleUnit(id)}
/>
<div class="flex flex-wrap items-center gap-3 pt-1">
    <button type="button" class="nt-plain-button" onclick={() => gameSession.counterAttack(picked)}>
        {picked.length === 0 ? 'No counter-attack' : 'Counter-attack'}
    </button>
    {#if preview !== undefined}
        <span class="nt-battle-result">Final result {preview > 0 ? '+' : ''}{preview}</span>
    {/if}
</div>
