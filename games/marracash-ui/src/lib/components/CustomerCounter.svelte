<script lang="ts">
    import { MarketColor } from '@tabletop/marracash'
    import PawnIcon from '$lib/components/PawnIcon.svelte'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { hoverOrTap } from '$lib/utils/hoverOrTap.js'
    import { PanelPalette } from '$lib/utils/playerPanel.js'

    const PawnHeight = 20

    let { playerId }: { playerId: string } = $props()
    const gameSession = getGameSession()

    let customers = $derived(gameSession.gameState.customersByColor(playerId))
</script>

<div class="flex justify-between rounded-md bg-black/40 px-1.5 py-1">
    {#each Object.values(MarketColor) as color (color)}
        {@const count = customers[color]}
        <span
            role="button"
            tabindex="0"
            aria-pressed={gameSession.customerHighlight?.playerId === playerId &&
                gameSession.customerHighlight?.color === color}
            class="flex items-center gap-0.5"
            aria-label="{count} {color} customers"
            use:hoverOrTap={{
                hover: (active) =>
                    gameSession.highlightCustomers(active ? { playerId, color } : undefined),
                tap: () => gameSession.toggleCustomerHighlight({ playerId, color })
            }}
        >
            <PawnIcon {color} height={PawnHeight} hollow={count === 0} />
            <span
                class="marracash-merchant inline-block min-w-[1.3ch] text-base tabular-nums"
                style:color={count > 0 ? PanelPalette.parchment : PanelPalette.quietCount}
                >{count}</span
            >
        </span>
    {/each}
</div>
