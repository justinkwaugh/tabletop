<script lang="ts">
    import type { RailroadId } from '@tabletop/south-african-railroads'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { RAILROAD_STYLE } from '$lib/utils/railroadStyle.js'

    let { railroadId, title }: { railroadId: RailroadId; title?: boolean } = $props()

    const style = $derived(RAILROAD_STYLE[railroadId])
    const gameSession = getGameSession()
    const definition = $derived(gameSession.gameState.map.railroad(railroadId))
</script>

<span
    class="badge"
    style:background={style.fill}
    style:color={style.text}
    title={title ? definition.name : undefined}>{definition.shortName}</span
>

<style>
    .badge {
        display: inline-block;
        border-radius: 4px;
        padding: 0 5px;
        font-weight: 700;
        font-size: 0.9em;
        line-height: 1.35;
        white-space: nowrap;
    }
</style>
