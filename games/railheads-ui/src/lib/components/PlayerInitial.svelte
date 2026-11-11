<script lang="ts">
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'

    let { playerId }: { playerId: string } = $props()

    const gameSession = getGameSession()

    const name = $derived(gameSession.getPlayerName(playerId))
</script>

<span
    class="initial"
    style:background={gameSession.colors.getPlayerUiColor(playerId)}
    style:color={gameSession.colors.getPlayerTextColorValue(playerId)}
    title={name}>{name.charAt(0).toUpperCase()}</span
>

<style>
    .initial {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 20px;
        height: 20px;
        border-radius: 2px;
        font-family: 'Railheads Baskerville', Georgia, serif;
        font-size: 13px;
        font-weight: 700;
        box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.35);
    }
</style>
