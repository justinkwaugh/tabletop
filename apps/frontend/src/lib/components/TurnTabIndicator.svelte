<script lang="ts">
    import { getAppContext } from '$lib/stores/appContext.svelte'
    import { showFaviconVariant } from '$lib/utils/favicon'

    let { gameId, gameName }: { gameId: string; gameName: string } = $props()

    const { gameService } = getAppContext()
    const isMyTurn = $derived(gameService.isSessionUsersTurn(gameId))
    const title = $derived(isMyTurn ? `Your turn · ${gameName}` : gameName)

    $effect(() => {
        document.title = title
        return () => {
            // Pages without their own title would keep this one; skip if the next page set its own
            if (document.title === title) {
                document.title = 'Board Together'
            }
        }
    })

    $effect(() => {
        if (!isMyTurn) {
            return
        }
        showFaviconVariant('favicon-turn')
        return () => showFaviconVariant('favicon')
    })
</script>
