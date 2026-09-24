<script lang="ts">
    import OpeningAuction from './OpeningAuction.svelte'
    import type { GameSession } from '@tabletop/frontend-components'
    import type { EighteenXXState, HydratedEighteenXXState } from '@tabletop/18xx'
    import { GameTable, OperatingActions, requireEighteenXXSession } from '@tabletop/18xx-ui'
    function createRouteWorker() {
        return new Worker(new URL('./autorouter.worker.js', import.meta.url), { type: 'module' })
    }
    let { gameSession }: { gameSession: GameSession<EighteenXXState, HydratedEighteenXXState> } =
        $props()
    const session = $derived(requireEighteenXXSession(gameSession))
    const privateOperationDescription = (id: string) =>
        id === 'SRR'
            ? 'Ignores mountain-only terrain costs. Combined river and mountain costs still apply.'
            : id === 'ER' && !session.gameState.usedPrivatePowerIds.includes(id)
              ? 'On purchase, the seller may immediately upgrade Ohzu in addition to ordinary construction.'
              : undefined
</script>

<GameTable {session} {privateOperationDescription}>
    {#snippet actions(_focusLocation, focusRoute)}
        {#if session.waterfall.model && !session.waterfall.model.auction.completed}
            <OpeningAuction {session} showUndo={false} />
        {:else}
            <OperatingActions
                {privateOperationDescription}
                onFocusRoute={focusRoute}
                {session}
                {createRouteWorker}
            />
        {/if}
    {/snippet}
</GameTable>
