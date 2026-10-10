<script lang="ts">
    import {
        CommandKind,
        UnitType,
        inReserve,
        type Side
    } from '@tabletop/napoleons-triumph'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import AttackerPicker from './AttackerPicker.svelte'

    let { side }: { side: Side } = $props()

    const gameSession = getGameSession()
    const game = $derived(gameSession.gameState)

    const picked = $derived(gameSession.battleStage?.picked ?? [])
    const orders = $derived(gameSession.battleStage?.orders)
    const gunsMayStay = $derived(
        orders !== undefined &&
            orders.every((order) => order.kind === CommandKind.Unit) &&
            picked.every((id) => {
                const unit = game.unit(id)
                return (
                    unit.face?.type === UnitType.Artillery &&
                    unit.position !== undefined &&
                    !inReserve(unit.position)
                )
            })
    )
</script>

<div class="nt-battle-prompt">
    The defender has given ground. Name the units that made the threat; they move into the locale.
</div>
<AttackerPicker {side} />
<div class="flex flex-wrap gap-2 pt-1">
    <button
        type="button"
        class="nt-plain-button"
        disabled={!orders}
        onclick={() => orders && gameSession.occupy(orders, false)}>Move into the locale</button
    >
    {#if gunsMayStay}
        <button
            type="button"
            class="nt-plain-button"
            onclick={() => orders && gameSession.occupy(orders, true)}>Show the guns and hold them in place</button
        >
    {/if}
</div>
