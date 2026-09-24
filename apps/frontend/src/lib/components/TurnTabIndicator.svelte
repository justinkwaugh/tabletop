<script lang="ts">
    import { getAppContext } from '$lib/stores/appContext.svelte'
    import { showFaviconVariant } from '$lib/utils/favicon'

    let { gameId, gameName }: { gameId: string; gameName: string } = $props()

    const { gameService } = getAppContext()
    const isMyTurn = $derived(gameService.isSessionUsersTurn(gameId))

    $effect(() => {
        if (!isMyTurn) {
            return
        }
        showFaviconVariant('favicon-turn')
        return () => showFaviconVariant('favicon')
    })
</script>

<svelte:head>
    <title>{isMyTurn ? 'Your turn · ' : ''}{gameName} — Board Together</title>
</svelte:head>
