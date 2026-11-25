<script lang="ts">
    import { getAppContext } from '$lib/stores/appContext.svelte'
    import { restoreDefaultFavicon, showTurnFavicon } from '$lib/utils/favicon'
    import type { UserAwaited } from '$lib/utils/dashboardGames'
    import { m } from '$lib/paraglide/messages'

    let { gameId, gameName }: { gameId: string; gameName: string } = $props()

    const { gameService } = getAppContext()
    const AWAITED_TITLES: Record<UserAwaited, (inputs: { game: string }) => string> = {
        answer: m.games_tab_title_answer,
        turn: m.games_tab_title_turn
    }

    const awaited = $derived(gameService.awaitedFromSessionUser(gameId))
    const title = $derived(awaited ? AWAITED_TITLES[awaited]({ game: gameName }) : gameName)

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
        if (!awaited) {
            return
        }
        showTurnFavicon()
        return restoreDefaultFavicon
    })
</script>
