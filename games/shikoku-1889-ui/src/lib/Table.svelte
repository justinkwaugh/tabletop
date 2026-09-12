<script lang="ts">
    import { Shikoku1889EndingRules } from '@tabletop/shikoku-1889'
    import { Shikoku1889TrainColors } from './trainPresentation.js'
    import { Shikoku1889OperatingRules } from '@tabletop/shikoku-1889'
    import OpeningAuction from './OpeningAuction.svelte'
    import type { GameSession } from '@tabletop/frontend-components'
    import type { GameState, HydratedGameState } from '@tabletop/common'
    import { GameTable, OperatingActions, requireFinanceExampleSession } from '@tabletop/18xx-ui'
    let { gameSession }: { gameSession: GameSession<GameState, HydratedGameState> } = $props()
    const session = $derived(requireFinanceExampleSession(gameSession))
</script>

<GameTable
    {session}
    valuationRules={Shikoku1889EndingRules}
    trainColors={Shikoku1889TrainColors}
    operatingRules={Shikoku1889OperatingRules}
    privateOperationDescription={(id) =>
        id === 'SRR'
            ? 'Ignores mountain-only terrain costs. Combined river and mountain costs still apply.'
            : id === 'ER' && !session.financialState.usedPrivatePowerIds.includes(id)
              ? 'On purchase, the seller may immediately upgrade Ohzu in addition to ordinary construction.'
              : undefined}
>
    {#snippet actions()}
        {#if session.auction && !session.auction.auction.completed}
            <OpeningAuction {session} showUndo={false} />
        {:else}
            <OperatingActions {session} />
        {/if}
    {/snippet}
</GameTable>
