<script lang="ts">
    import { ActionType, FeintEnd, inReserve, type Side } from '@tabletop/napoleons-triumph'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import AttackerPicker from './AttackerPicker.svelte'

    let { side }: { side: Side } = $props()

    const gameSession = getGameSession()
    const game = $derived(gameSession.gameState)
    const picked = $derived(gameSession.battleStage?.picked ?? [])
    const orders = $derived(gameSession.battleStage?.orders)
    const fromReserve = $derived(
        picked.length > 0 && picked.every((id) => {
            const position = game.unit(id).position
            return position !== undefined && inReserve(position)
        })
    )
    const canPress = $derived(gameSession.validActionTypes.includes(ActionType.PressAttack))
</script>

<div class="nt-battle-prompt">
    The defence stands. Press the attack to see its leading units, or call it a feint with the
    units you pick.
</div>
<AttackerPicker {side} />
<div class="flex flex-wrap gap-2 pt-1">
    {#if canPress}
        <button type="button" class="nt-plain-button" onclick={() => gameSession.pressAttack()}
            >Press the attack</button
        >
    {/if}
    {#if fromReserve}
        <button
            type="button"
            class="nt-plain-button"
            disabled={!orders}
            onclick={() => orders && gameSession.feint(orders, FeintEnd.Approach)}
            >Feint, moving up to the approach</button
        >
        <button
            type="button"
            class="nt-plain-button"
            disabled={!orders}
            onclick={() => orders && gameSession.feint(orders, FeintEnd.Reserve)}
            >Feint, staying in reserve</button
        >
    {:else}
        <button
            type="button"
            class="nt-plain-button"
            disabled={!orders}
            onclick={() => orders && gameSession.feint(orders, FeintEnd.Approach)}>Feint in place</button
        >
    {/if}
</div>
