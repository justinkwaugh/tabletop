<script lang="ts">
    import { mustDefend, retreatingUnits, type Side } from '@tabletop/napoleons-triumph'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import Force from './Force.svelte'
    import RetreatStep from './RetreatStep.svelte'

    let { side }: { side: Side } = $props()

    const gameSession = getGameSession()
    const game = $derived(gameSession.gameState)
    const forced = $derived(mustDefend(game))
    const stage = $derived(gameSession.battleStage)
    const candidates = $derived(stage?.candidates ?? [])
    const others = $derived(retreatingUnits(game).filter((unit) => !candidates.includes(unit)))
    const pieces = $derived(stage?.picked ?? [])
    const leaders = $derived(stage?.leaders ?? [])
    const retreating = $derived(gameSession.battleDraft.retreating)
</script>

{#if retreating}
    <RetreatStep {side} oncancel={() => gameSession.updateBattleDraft({ retreating: false })} />
{:else}
    <div class="nt-battle-prompt">
        {#if forced}
            Your pieces on the approach must defend. Tap a unit, here or on the map, to lead with it.
        {:else}
            Tap units, here or on the map, to defend with them; tap again to lead. Or give ground.
        {/if}
        Leading units stay hidden unless the attack is pressed.
    </div>
    <Force
        {side}
        units={candidates}
        selected={pieces}
        markers={stage?.roles}
        onpick={(id) => gameSession.pickBattleUnit(id)}
    />
    {#if others.length > 0}
        <div class="nt-battle-faint">Elsewhere in the locale</div>
        <Force {side} units={others} />
    {/if}
    {#if stage?.problem}
        <div class="nt-battle-warning">{stage.problem}.</div>
    {/if}
    <div class="flex flex-wrap gap-2 pt-1">
        <button
            type="button"
            class="nt-plain-button"
            disabled={pieces.length === 0 || stage?.problem !== undefined}
            onclick={() => gameSession.declareDefense(pieces, leaders)}
        >
            Defend{leaders.length === 0 ? ' with no leading unit' : ''}
        </button>
        {#if !forced}
            <button type="button" class="nt-plain-button" onclick={() => gameSession.updateBattleDraft({ retreating: true })}
                >Retreat before combat</button
            >
        {/if}
    </div>
{/if}
