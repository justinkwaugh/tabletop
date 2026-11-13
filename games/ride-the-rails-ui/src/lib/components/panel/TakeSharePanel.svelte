<script lang="ts">
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { shareButtonDetail, shareButtons, shareOrder } from '$lib/model/actionArea.js'
    import { railroadName } from '$lib/utils/describeAction.js'
    import LocomotiveIcon from '../board/LocomotiveIcon.svelte'

    const gameSession = getGameSession()

    const playerId = $derived(gameSession.myPlayerId)
    const buttons = $derived(playerId ? shareButtons(gameSession.gameState, playerId) : [])

    // R-2.2: "phase 1 goes in reverse turn order: you first, then Ezra, Silas, Hattie".
    const orderText = $derived.by(() => {
        const names = shareOrder(gameSession.gameState).map((id) =>
            id === playerId ? 'you' : gameSession.getPlayerName(id)
        )
        const [first, ...rest] = names
        return rest.length > 0 ? `${first} first, then ${rest.join(', ')}` : first
    })
</script>

<div class="flex flex-wrap items-baseline gap-x-3">
    <h2 class="text-base font-bold">Take a share</h2>
    <span class="text-sm text-rtr-ink-muted max-sm:hidden"
        >phase 1 goes in reverse turn order: {orderText}</span
    >
</div>
<div class="mt-2 grid grid-cols-3 gap-2 sm:flex sm:flex-wrap">
    {#each buttons as button (button.railroadId)}
        {@const enabled = gameSession.shareChoices.includes(button.railroadId)}
        <button
            type="button"
            class="flex min-w-0 flex-col items-start gap-0.5 rounded-lg border border-rtr-line bg-rtr-panel-raised px-2.5 py-1.5 text-left hover:border-rtr-accent focus-visible:outline-2 focus-visible:outline-rtr-accent disabled:pointer-events-none disabled:opacity-50 sm:w-32"
            disabled={!enabled}
            aria-label="{railroadName(button.railroadId)}, {shareButtonDetail(button)}"
            onclick={() => gameSession.takeShare(button.railroadId)}
        >
            <span class="flex items-center gap-1.5 text-sm font-semibold">
                <LocomotiveIcon railroadId={button.railroadId} width={24} />
                <span class="truncate">{railroadName(button.railroadId)}</span>
            </span>
            <span class="text-xs whitespace-nowrap text-rtr-ink-muted"
                >{shareButtonDetail(button)}</span
            >
        </button>
    {/each}
</div>
