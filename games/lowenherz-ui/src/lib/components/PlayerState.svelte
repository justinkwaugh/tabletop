<script lang="ts">
    import { type Player } from '@tabletop/common'
    import { LowenherzPlayerState, type PoliticsCard, PoliticsCardType } from '@tabletop/lowenherz'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'

    let gameSession = getGameSession()
    let { player, playerState }: { player: Player; playerState: LowenherzPlayerState } = $props()

    let isTurn = $derived(gameSession.game.state?.activePlayerIds.includes(player.id))
    let bgColor = $derived(gameSession.colors.getPlayerBgColor(player.id))
    let regionCount = $derived(
        gameSession.gameState.regions.filter((r) => r.ownerColor === playerState.color).length
    )
    // Kept face-down per the rulebook - shown as specific cards only in the owning
    // player's own panel (a UI convention, not server-enforced - see
    // LowenherzPlayerState.politicsCards), just a count for everyone else's.
    let isMe = $derived(gameSession.myPlayer?.id === player.id)

    function politicsCardLabel(card: PoliticsCard): string {
        switch (card.type) {
            case PoliticsCardType.Alliance:
                return 'Alliance'
            case PoliticsCardType.Renegade:
                return 'Renegade'
            case PoliticsCardType.Parchment:
                return `Parchment (${card.value})`
            case PoliticsCardType.Treasure:
                return `Treasure (${card.value})`
        }
    }
</script>

<div class="relative">
    <div
        class="rounded-lg {bgColor} py-[3px] px-4 text-center {gameSession.colors.getPlayerTextColor(
            playerState.playerId
        )} font-medium flex flex-col justify-between {isTurn ? 'border-2 pulse-border' : ''}"
    >
        <h1 class="{isTurn ? 'text-xl font-semibold' : 'text-lg font-medium'} mb-2">
            {isTurn ? '\u21e2 ' : ''}{player.name}{isTurn ? ' \u21e0' : ''}
        </h1>
        <div class="text-sm font-semibold">Power: {playerState.powerPoints}</div>
        <div class="text-sm font-semibold">Money: {playerState.money}</div>
        {#if playerState.politicsCards.length > 0}
            <div class="text-xs">
                Politics: {isMe
                    ? playerState.politicsCards.map(politicsCardLabel).join(', ')
                    : playerState.politicsCards.length}
            </div>
        {/if}
        {#if gameSession.showDebug}
            <div class="text-xs mt-2">id: {player.id}</div>
            <div class="text-xs">regions: {regionCount}</div>
        {/if}
    </div>
</div>

<style>
    @keyframes border-pulsate {
        0% {
            border-color: rgba(255, 255, 255, 0);
        }
        25% {
            border-color: rgba(255, 255, 255, 255);
        }
        75% {
            border-color: rgba(255, 255, 255, 255);
        }
        100% {
            border-color: rgba(255, 255, 255, 0);
        }
    }

    .pulse-border {
        border-color: white;
        animation: border-pulsate 2.5s infinite;
    }
</style>
