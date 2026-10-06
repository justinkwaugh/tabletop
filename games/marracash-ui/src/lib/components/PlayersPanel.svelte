<script lang="ts">
    import { onDestroy } from 'svelte'
    import type { Player } from '@tabletop/common'
    import type { HydratedMarracashPlayerState } from '@tabletop/marracash'
    import PlayerState from '$lib/components/PlayerState.svelte'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    // PROTOTYPE: player card variants, see prototype/README.md
    import PrototypeSwitcher from '$lib/components/prototype/PrototypeSwitcher.svelte'
    import StallCard from '$lib/components/prototype/StallCard.svelte'
    import LedgerCard from '$lib/components/prototype/LedgerCard.svelte'
    import RiadCard from '$lib/components/prototype/RiadCard.svelte'

    const Variants = [
        { key: 'current', label: 'Current' },
        { key: 'stall', label: 'Market stall' },
        { key: 'ledger', label: 'Merchant ledger' },
        { key: 'riad', label: 'Riad doorway' }
    ]
    let variant = $state(
        new URLSearchParams(globalThis.location?.search ?? '').get('variant') ?? 'stall'
    )
    function chooseVariant(key: string) {
        variant = key
        const url = new URL(window.location.href)
        url.searchParams.set('variant', key)
        history.replaceState(history.state, '', url)
    }

    const gameSession = getGameSession()
    onDestroy(() => gameSession.highlightCustomers(undefined))

    type PlayerAndState = { player: Player; playerState: HydratedMarracashPlayerState }

    let seated: PlayerAndState[] = $derived.by(() => {
        const inTurnOrder = gameSession.gameState.turnManager.turnOrder.flatMap((playerId) => {
            const player = gameSession.game.players.find((candidate) => candidate.id === playerId)
            const playerState = gameSession.gameState.findPlayerState(playerId)
            return player && playerState ? [{ player, playerState }] : []
        })
        const myId = gameSession.myPlayer?.id
        const myIndex = inTurnOrder.findIndex((entry) => entry.player.id === myId)
        return gameSession.primaryGame.hotseat || myIndex < 0
            ? inTurnOrder
            : [...inTurnOrder.slice(myIndex), ...inTurnOrder.slice(0, myIndex)]
    })
</script>

<div
    class="flex shrink-0 grow-0 flex-col rounded-lg"
    class:gap-2={variant !== 'stall'}
    class:gap-3={variant === 'stall'}
>
    {#each seated as entry (entry.player.id)}
        {#if variant === 'stall'}
            <StallCard player={entry.player} playerState={entry.playerState} />
        {:else if variant === 'ledger'}
            <LedgerCard player={entry.player} playerState={entry.playerState} />
        {:else if variant === 'riad'}
            <RiadCard player={entry.player} playerState={entry.playerState} />
        {:else}
            <PlayerState player={entry.player} playerState={entry.playerState} />
        {/if}
    {/each}
</div>
<PrototypeSwitcher variants={Variants} current={variant} onchange={chooseVariant} />
