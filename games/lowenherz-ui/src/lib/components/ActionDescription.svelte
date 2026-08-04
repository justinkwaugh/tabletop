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
        isPlayAllianceCard,
        isPlayRenegadeCard,
        isCancelAlliance,
        isSubmitDuelBid,
        isLookAtPoliticsPile,
        isTakePoliticsCard,
        NegotiationMoveKind,
        PoliticsCardType
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
    // Pile A always renders on the left, pile B on the right (see DeckPiles.svelte) -
    // history should describe piles the way a player actually sees them on screen.
    const pileLabels: Record<'A' | 'B', string> = { A: 'left', B: 'right' }

    // A region can enclose any number of towns (each worth 5 points), so the count
    // has to be spelled out rather than a bare "including a town" - the plain
    // article only reads better in the singular.
    function townsPhrase(count?: number): string {
        if (!count) return ''
        return count === 1 ? ', including a town' : `, including ${count} towns`
    }

    function politicsCardLabel(type: PoliticsCardType, value?: number): string {
        switch (type) {
            case PoliticsCardType.Alliance:
                return 'Alliance'
            case PoliticsCardType.Renegade:
                return 'Renegade'
            case PoliticsCardType.Parchment:
                return `Parchment (${value})`
            case PoliticsCardType.Treasure:
                return `Treasure (${value})`
        }
    }
</script>

{#if isPlaceCastle(action)}
    placed a castle with a knight
{:else if isDrawActionCard(action)}
    {#if action.metadata?.cardType === ActionCardType.Mining}
        drew a Silver Mine card
        {#if action.metadata.hillScoring && action.metadata.hillScoring.length > 0}
            {#each action.metadata.hillScoring as entry (entry.playerId)}
                <br />
                <PlayerName playerId={entry.playerId} /> gained {entry.points} power point{entry.points === 1
                    ? ''
                    : 's'}
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
    {#if action.kind === NegotiationMoveKind.Propose}
        proposed <PlayerName playerId={action.fromPlayerId ?? ''} /> pay {action.amount} ducat{action.amount ===
        1
            ? ''
            : 's'} for the contested action
    {:else if action.kind === NegotiationMoveKind.Sign}
        {@const executedOffer = action.metadata?.executedOffer}
        {#if executedOffer}
            signed — <PlayerName playerId={executedOffer.fromPlayerId} /> paid {executedOffer.amount} ducat{executedOffer.amount ===
            1
                ? ''
                : 's'} and performed the action
        {:else}
            signed the standing offer
        {/if}
    {:else}
        declined to negotiate further — forcing a duel
    {/if}
{:else if isSubmitDuelBid(action)}
    bid {action.amount} ducat{action.amount === 1 ? '' : 's'}{#if action.metadata?.treasureCardUsed}
        {' '}+ a {politicsCardLabel(
            action.metadata.treasureCardUsed.type,
            action.metadata.treasureCardUsed.value
        )} card
    {/if} in the duel{#if action.metadata?.duelResult};{/if}
    {#if action.metadata?.duelResult === 'win' && action.metadata.winnerId}
        <br /><PlayerName playerId={action.metadata.winnerId} /> won the duel
    {:else if action.metadata?.duelResult === 'reduel'}
        {@const tied = action.metadata.reduelPlayerIds ?? []}
        <br />the duel was tied{#if tied.length > 0}{' '}between{' '}{#each tied as playerId, i (playerId)}{i >
                0
                    ? i === tied.length - 1
                        ? ' and '
                        : ', '
                    : ''}<PlayerName {playerId} />{/each}{/if} — they duel again
    {:else if action.metadata?.duelResult === 'giveUp'}
        <br />the second duel was tied too, so no one performs the action
    {/if}
{:else if isPlaceWall(action)}
    placed a wall
    {#if action.metadata?.completedRegions && action.metadata.completedRegions.length > 0}
        {#each action.metadata.completedRegions as region, i (i)}
            <br />
            {#if region.ownerColor}
                {@const ownerId = playerIdForColor(region.ownerColor)}
                {#if ownerId}
                    <PlayerName playerId={ownerId} possessive />
                {:else}
                    A neutral prince's
                {/if}
                region was completed ({region.spaceCount} space{region.spaceCount === 1
                    ? ''
                    : 's'}{townsPhrase(region.townCount)}) for +{region.points} power point{region.points ===
                1
                    ? ''
                    : 's'}
            {:else}
                a neutral zone ({region.spaceCount} space{region.spaceCount === 1 ? '' : 's'}) was sealed off
            {/if}
        {/each}
    {/if}
{:else if isPlaceKnight(action)}
    placed a knight
    {#if action.metadata?.paidWithTreasureCard}
        , paying with a {politicsCardLabel(
            action.metadata.paidWithTreasureCard.type,
            action.metadata.paidWithTreasureCard.value
        )} card for the wooded space
    {:else if action.metadata?.woodedCostPaid}
        , paying {action.metadata.woodedCostPaid} ducats for the wooded space
    {/if}
{:else if isExpandRegion(action)}
    expanded a region by 1 space
    {townsPhrase(action.metadata?.townsTaken)}
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
                    <PlayerName playerId={ownerId} possessive />
                {:else}
                    A neutral prince's
                {/if}
                region elsewhere was incidentally completed ({region.spaceCount} space{region.spaceCount ===
                1
                    ? ''
                    : 's'}{townsPhrase(region.townCount)}) for +{region.points} power point{region.points ===
                1
                    ? ''
                    : 's'}
            {:else}
                a neutral zone elsewhere ({region.spaceCount} space{region.spaceCount === 1 ? '' : 's'}) was
                incidentally sealed off
            {/if}
        {/each}
    {/if}
{:else if isLookAtPoliticsPile(action)}
    looked through the {pileLabels[action.pile]} politics pile
{:else if isTakePoliticsCard(action)}
    {@const isMe = gameSession.myPlayer?.id === action.playerId}
    {@const takenCard = gameSession.gameState
        .getPlayerState(action.playerId)
        .politicsCards.find((c) => c.id === action.cardId)}
    took a politics card from the {pileLabels[action.pile]} pile{#if isMe && takenCard}
        {' '}({politicsCardLabel(takenCard.type, takenCard.value)}){/if}
{:else if isPlayRenegadeCard(action)}
    {@const victimId = playerIdForColor(action.metadata?.victimColor)}
    played a Renegade card — removed a knight from
    {#if victimId}
        <PlayerName playerId={victimId} />'s
    {:else}
        a neutral prince's
    {/if}
    region and placed one of their own in exchange
    {#if action.metadata?.removalWoodedCostPaid}
        , paying {action.metadata.removalWoodedCostPaid} ducats to remove it from the woods
    {/if}
    {#if action.metadata?.placementWoodedCostPaid}
        , paying {action.metadata.placementWoodedCostPaid} ducats to place into the woods
    {/if}
{:else if isPlayAllianceCard(action)}
    {@const enemyId = playerIdForColor(action.metadata?.enemyColor)}
    played an Alliance card — allied one of their regions with
    {#if enemyId}
        <PlayerName playerId={enemyId} />'s
    {:else}
        a neutral prince's
    {/if}
    neighboring region; neither can be expanded into the other while it lasts
{:else if isCancelAlliance(action)}
    {@const otherId = playerIdForColor(action.metadata?.otherColor)}
    paid 10 ducats to end an alliance with
    {#if otherId}
        <PlayerName playerId={otherId} />
    {:else}
        a neutral prince
    {/if}
{:else if isPass(action)}
    passed, declining to place any more
{:else if isAdvanceResolution(action)}
    {@const meta = action.metadata}
    {#if meta?.moneyBagRecipientIds}
        {#if meta.moneyBagRecipientIds.length === 1}
            <PlayerName playerId={meta.moneyBagRecipientIds[0]} /> claimed the money bag (+{meta.moneyBagAmountEach}
            ducat{meta.moneyBagAmountEach === 1 ? '' : 's'})
        {:else if meta.moneyBagRecipientIds.length > 0}
            {#each meta.moneyBagRecipientIds as playerId, i (playerId)}
                {i > 0 ? ', ' : ''}<PlayerName {playerId} />
            {/each}
            split the money bag (+{meta.moneyBagAmountEach} ducat{meta.moneyBagAmountEach === 1 ? '' : 's'} each)
        {:else}
            <span class="text-gray-500">no one chose the money bag - nothing to split</span>
        {/if}
    {:else if meta?.slotResolved}
        {#if meta.slotWinnerPlayerId}
            <PlayerName playerId={meta.slotWinnerPlayerId} />
            {#if meta.bandKind === 'border'}
                won the right to place {meta.bandCount} wall{meta.bandCount === 1 ? '' : 's'}
                {#if meta.placementSkippedReason === 'regionCap'}
                    <span class="text-gray-500">— but already controls 3 regions; their turn is skipped</span>
                {:else if meta.placementSkippedReason === 'noLegalWallSpots'}
                    <span class="text-gray-500"
                        >— but there's nowhere left to legally place one, so their turn is skipped</span
                    >
                {/if}
            {:else if meta.bandKind === 'knight'}
                won the right to place {meta.bandCount} knight{meta.bandCount === 1 ? '' : 's'}
                {#if meta.placementSkippedReason === 'noKnightsInStock'}
                    <!-- An empty stock alone no longer wastes the action - it can still
                         be spent expanding a region, so this only fires when there's no
                         region of theirs to expand either (see resolveBandForWinner). -->
                    <span class="text-gray-500"
                        >— but has no knights left in stock and no region to expand; their turn is skipped</span
                    >
                {/if}
            {:else}
                won the {slotLabels[meta.slot!]} action outright
            {/if}
        {:else}
            <span class="text-gray-500">no one chose the {slotLabels[meta.slot!]} action</span>
        {/if}
    {:else if meta?.tiedPlayerIds}
        {#each meta.tiedPlayerIds as playerId, i (playerId)}
            {i > 0 ? (i === meta.tiedPlayerIds.length - 1 ? ' and ' : ', ') : ''}<PlayerName {playerId} />
        {/each}
        tied for the {slotLabels[meta.slot!]} action and {meta.tieWentToDuel ? 'duel for it' : 'enter negotiations'}
    {:else if meta?.roundAdvanced}
        {@const newFirstIsMe = gameSession.myPlayer?.id === meta.newFirstPlayerId}
        <span class="text-gray-500">
            the round is over and {#if meta.newFirstPlayerId}<PlayerName
                    playerId={meta.newFirstPlayerId}
                />{:else}the next player{/if}
            {newFirstIsMe ? 'became' : 'becomes'} the first player
        </span>
    {:else}
        <span class="text-gray-500">(the round continues...)</span>
    {/if}
{:else}
    performed an action
{/if}
