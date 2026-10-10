<script lang="ts">
    import { inReserve, type Side } from '@tabletop/napoleons-triumph'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import Force from './Force.svelte'

    let { side }: { side: Side } = $props()

    const gameSession = getGameSession()
    const stage = $derived(gameSession.battleStage)
    const candidates = $derived(stage?.candidates ?? [])
    const attackLocale = $derived(gameSession.battleLocales[0])
    const inPlace = $derived(candidates.filter((unit) => unit.position?.locale === attackLocale))
    const onApproach = $derived(
        inPlace.filter((unit) => unit.position !== undefined && !inReserve(unit.position))
    )
    const reserve = $derived(
        inPlace.filter((unit) => unit.position !== undefined && inReserve(unit.position))
    )
    const byRoad = $derived(candidates.filter((unit) => unit.position?.locale !== attackLocale))
</script>

{#if stage}
    {#if onApproach.length > 0}
        <div class="nt-battle-faint">On the approach</div>
        <Force
            {side}
            units={onApproach}
            selected={stage.picked}
            markers={stage.roles}
            onpick={(id) => gameSession.pickBattleUnit(id)}
        />
    {/if}
    {#if reserve.length > 0}
        <div class="nt-battle-faint">In reserve</div>
        <Force
            {side}
            units={reserve}
            selected={stage.picked}
            markers={stage.roles}
            onpick={(id) => gameSession.pickBattleUnit(id)}
        />
    {/if}
    {#if byRoad.length > 0}
        <div class="nt-battle-faint">Cavalry that can ride up by road</div>
        <Force
            {side}
            units={byRoad}
            selected={stage.picked}
            markers={stage.roles}
            onpick={(id) => gameSession.pickBattleUnit(id)}
        />
    {/if}
    {#if candidates.length === 0}
        <div class="nt-battle-faint">No unit here can still be commanded.</div>
    {/if}
{/if}
