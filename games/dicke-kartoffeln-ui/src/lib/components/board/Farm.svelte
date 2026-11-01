<script lang="ts">
    import { PlanKind } from '@tabletop/dicke-kartoffeln'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { FARM_ART_HEIGHT, FARM_ART_WIDTH, farmLayout } from '$lib/utils/farmLayouts.js'
    import { CompostPileId, compostUseYear } from '$lib/utils/rounds.js'
    import CompostPile from './CompostPile.svelte'
    import Field from './Field.svelte'

    let {
        playerId,
        width,
        interactive = true
    }: { playerId: string; width: number; interactive?: boolean } = $props()

    const gameSession = getGameSession()

    const player = $derived(gameSession.gameState.getPlayerState(playerId))
    const layout = $derived(farmLayout(player.farm))
    const scale = $derived(width / FARM_ART_WIDTH)
    const planning = $derived(
        interactive && gameSession.planning && playerId === gameSession.myPlayerId
    )
    const taken = $derived(
        planning && gameSession.planKind === PlanKind.TakeCompost
            ? player.fields.reduce((sum, field) => sum - gameSession.draftWorms(field.id), 0)
            : 0
    )
    const spread = $derived(planning ? gameSession.wormsSpread : 0)

    const timed = $derived(interactive && !gameSession.gameState.result)
    function readyYear(pile: CompostPileId): number | undefined {
        return timed
            ? compostUseYear(gameSession.gameState.machineState, gameSession.year, pile)
            : undefined
    }
</script>

<div class="farm" style:width="{width}px" style:height="{FARM_ART_HEIGHT * scale}px">
    <img src={layout.image} alt="Farm of {gameSession.getPlayerName(playerId)}" class="art" />
    {#each player.fields as field, index (field.id)}
        <Field {field} area={layout.fields[index]} {scale} {planning} ownerId={playerId} />
    {/each}
    <CompostPile
        worms={player.freshCompost}
        change={taken}
        area={layout.compost[0]}
        {scale}
        label="Compost pile 1"
        readyYear={readyYear(CompostPileId.Fresh)}
    />
    <CompostPile
        worms={player.ripeCompost}
        change={-spread}
        area={layout.compost[1]}
        {scale}
        label="Compost pile 2"
        readyYear={readyYear(CompostPileId.Ripe)}
    />
</div>

<style>
    .farm {
        position: relative;
        flex: none;
        overflow: hidden;
        border-radius: 6px;
        box-shadow: 0 3px 10px rgba(40, 30, 10, 0.45);
    }

    .art {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
        user-select: none;
        pointer-events: none;
    }
</style>
