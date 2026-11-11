<script lang="ts" module>
    export const CERTIFICATE_WIDTH = 46
    export const CERTIFICATE_HEIGHT = 19
</script>

<script lang="ts">
    import type { RailroadId } from '@tabletop/south-african-railroads'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { RAILROAD_STYLE } from '$lib/utils/railroadStyle.js'

    let { railroadId, labelled = true }: { railroadId: RailroadId; labelled?: boolean } = $props()

    const style = $derived(RAILROAD_STYLE[railroadId])
    const gameSession = getGameSession()
    const definition = $derived(gameSession.gameState.map.railroad(railroadId))
</script>

<span
    class="certificate"
    style:width="{CERTIFICATE_WIDTH}px"
    style:height="{CERTIFICATE_HEIGHT}px"
    style:--rr={style.fill}
    style:--rr-text={style.text}
    title="{definition.name} share">{labelled ? definition.shortName : ''}</span
>

<style>
    .certificate {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        box-sizing: border-box;
        border-radius: 2px;
        background: var(--rr);
        color: var(--rr-text);
        font-family: 'Libre Baskerville', Georgia, serif;
        font-size: 10px;
        letter-spacing: -0.02em;
        font-weight: 700;
        white-space: nowrap;
        box-shadow:
            inset 0 0 0 1.5px rgba(255, 255, 255, 0.55),
            0 0 0 1px rgba(0, 0, 0, 0.35);
    }
</style>
