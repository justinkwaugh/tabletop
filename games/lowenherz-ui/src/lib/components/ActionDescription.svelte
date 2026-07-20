<script lang="ts">
    import { type GameAction } from '@tabletop/common'
    import { PlayerName } from '@tabletop/frontend-components'
    import {
        ActionCardType,
        isAdvanceResolution,
        isChooseAction,
        isDrawActionCard,
        isNegotiationMove,
        isExpandRegion,
        isPass,
        isPlaceCastle,
        isPlaceKnight,
        isPlaceWall,
        isSubmitDuelBid,
        NegotiationMoveKind
    } from '@tabletop/lowenherz'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'

    let {
        action,
        justify = 'start',
        history = true
    }: { action: GameAction; justify?: 'start' | 'center' | 'end'; history?: boolean } = $props()

    const gameSession = getGameSession()

    function playerIdForColor(color?: string): string | undefined {
        if (!color) return undefined
        return gameSession.gameState.players.find((p) => p.color === color)?.playerId
    }

    const slotLabels: Record<1 | 2 | 3, string> = { 1: 'top', 2: 'middle', 3: 'bottom' }
</script>

{#if isPlaceCastle(action)}
    placed a castle at ({action.castleCol}, {action.castleRow}) with a knight at ({action.knightCol},
    {action.knightRow})
{:else if isDrawActionCard(action)}
    {#if action.metadata?.cardType === ActionCardType.Mining}
        drew a Silver Mine card
        {#if action.metadata.hillScoring && action.metadata.hillScoring.length > 0}
            —
            {#each action.metadata.hillScoring as entry, i (entry.playerId)}
                {i > 0 ? ', ' : ''}<PlayerName playerId={entry.playerId} /> gained {entry.points}
                power point{entry.points === 1 ? '' : 's'}
            {/each}
        {/if}
    {:else if action.metadata?.cardType === ActionCardType.KingIsDead}
        drew The King is Dead — the game is over!
        {#if action.metadata.hillScoring && action.metadata.hillScoring.length > 0}
            <br />
            {#each action.metadata.hillScoring as entry, i (entry.playerId)}
                {i > 0 ? ', ' : ''}<PlayerName playerId={entry.playerId} /> gained {entry.points}
                power point{entry.points === 1 ? '' : 's'}
            {/each}
        {/if}
    {:else}
        drew the next action card
    {/if}
{:else if isChooseAction(action)}
    chose the {slotLabels[action.slot]} action
{:else if isNegotiationMove(action)}
    {#if action.kind === NegotiationMoveKind.Offer}
        offered {action.amount} ducat{action.amount === 1 ? '' : 's'} for the contested action
    {:else if action.kind === NegotiationMoveKind.Accept}
        accepted the offer and won the contested action
    {:else}
        declined to negotiate further — forcing a duel
    {/if}
{:else if isSubmitDuelBid(action)}
    bid {action.amount} ducat{action.amount === 1 ? '' : 's'} in the duel
{:else if isPlaceWall(action)}
    placed a wall
    {#if action.metadata?.completedRegions && action.metadata.completedRegions.length > 0}
        {#each action.metadata.completedRegions as region, i (i)}
            <br />
            {#if region.ownerColor}
                {@const ownerId = playerIdForColor(region.ownerColor)}
                {#if ownerId}
                    <PlayerName playerId={ownerId} />
                {:else}
                    A neutral prince's
                {/if}
                region was completed ({region.spaceCount} space{region.spaceCount === 1 ? '' : 's'}{region.townCount >
                0
                    ? ', including a town'
                    : ''}) for +{region.points} power point{region.points === 1 ? '' : 's'}
            {:else}
                a neutral zone ({region.spaceCount} space{region.spaceCount === 1 ? '' : 's'}) was sealed off
            {/if}
        {/each}
    {/if}
{:else if isPlaceKnight(action)}
    placed a knight at ({action.col}, {action.row})
    {#if action.metadata?.woodedCostPaid}
        , paying {action.metadata.woodedCostPaid} ducats for the wooded space
    {/if}
{:else if isExpandRegion(action)}
    expanded a region by {action.metadata?.spacesTaken ?? action.spaces.length} space{(action
        .metadata?.spacesTaken ?? action.spaces.length) === 1
        ? ''
        : 's'}
    {#if action.metadata?.townsTaken}, including a town{/if}
    for +{action.metadata?.pointsGained ?? 0} power point{(action.metadata?.pointsGained ?? 0) === 1
        ? ''
        : 's'}
    {#if action.metadata?.invasions && action.metadata.invasions.length > 0}
        {#each action.metadata.invasions as invasion, i (i)}
            <br />
            {@const victimId = playerIdForColor(invasion.victimColor)}
            {#if victimId}
                <PlayerName playerId={victimId} />
            {:else}
                A neutral prince
            {/if}
            lost {invasion.directSpacesLost} space{invasion.directSpacesLost === 1 ? '' : 's'} (-{invasion.directPointsLost}
            power point{invasion.directPointsLost === 1 ? '' : 's'})
            {#if invasion.disconnectedSpaces > 0}
                , and {invasion.disconnectedSpaces} more space{invasion.disconnectedSpaces === 1
                    ? ''
                    : 's'} were cut off into a neutral zone (-{invasion.disconnectedPointsLost} power point{invasion.disconnectedPointsLost ===
                1
                    ? ''
                    : 's'})
            {/if}
        {/each}
    {/if}
    {#if action.metadata?.completedRegions && action.metadata.completedRegions.length > 0}
        {#each action.metadata.completedRegions as region, i (i)}
            <br />
            {#if region.ownerColor}
                {@const ownerId = playerIdForColor(region.ownerColor)}
                {#if ownerId}
                    <PlayerName playerId={ownerId} />
                {:else}
                    A neutral prince's
                {/if}
                region elsewhere was incidentally completed ({region.spaceCount} space{region.spaceCount ===
                1
                    ? ''
                    : 's'}{region.townCount > 0 ? ', including a town' : ''}) for +{region.points} power point{region.points ===
                1
                    ? ''
                    : 's'}
            {:else}
                a neutral zone elsewhere ({region.spaceCount} space{region.spaceCount === 1 ? '' : 's'}) was
                incidentally sealed off
            {/if}
        {/each}
    {/if}
{:else if isPass(action)}
    passed, declining to place any more
{:else if isAdvanceResolution(action)}
    <span class="text-gray-500">(the round continues...)</span>
{:else}
    performed an action
{/if}
