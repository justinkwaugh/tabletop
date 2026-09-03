<script lang="ts">
    import { type GameAction } from '@tabletop/common'
    import { PlayerName } from '@tabletop/frontend-components'
    import {
        ActionCardType,
        getSquare,
        isAdvanceResolution,
        isChooseAction,
        isDrawActionCard,
        isNegotiationMove,
        isNeutralOwner,
        isExpandRegion,
        isPass,
        isPlaceCastle,
        isPlaceSetupKnight,
        isPlaceKnight,
        isPlaceWall,
        isPlayAllianceCard,
        isPlayRenegadeCard,
        isCancelAlliance,
        isSubmitDuelBid,
        isLookAtPoliticsPile,
        isTakePoliticsCard,
        NegotiationMoveKind,
        PoliticsCardType,
        type PieceOwner,
        type SlotKind
    } from '@tabletop/lowenherz'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { duelRoundEndingWith } from '$lib/model/duelRounds.js'

    let {
        action,
        justify = 'start',
        history = true
    }: { action: GameAction; justify?: 'start' | 'center' | 'end'; history?: boolean } = $props()

    const gameSession = getGameSession()

    // The neutral prince has no player to name, so it reads as "a neutral prince" in the
    // feed rather than as a PlayerName.
    function playerIdForOwner(owner?: PieceOwner): string | undefined {
        return owner && !isNeutralOwner(owner) ? owner : undefined
    }

    // The pack this draw rolled the deck into, or undefined if it stayed in the same one.
    // Found by walking back to the PREVIOUS draw and comparing backs - the deck keeps no
    // record of the card drawn before this one. The scan stops at the first earlier draw,
    // which is at most a round away, so it doesn't grow with the length of the game.
    const packRolledTo = $derived.by(() => {
        if (!isDrawActionCard(action) || !action.metadata?.back) return undefined
        const actions = gameSession.actions
        const index = actions.findIndex((candidate) => candidate.id === action.id)
        if (index < 0) return undefined
        for (let i = index - 1; i >= 0; i--) {
            const earlier = actions[i]
            if (!isDrawActionCard(earlier)) continue
            // The first draw of the game has no predecessor to differ from, so it never
            // announces a change - deck A isn't news.
            return earlier.metadata?.back && earlier.metadata.back !== action.metadata.back
                ? { from: earlier.metadata.back, to: action.metadata.back }
                : undefined
        }
        return undefined
    })

    const slotKindLabels: Record<SlotKind, string> = {
        income: 'income',
        politics: 'politics',
        border: 'walls',
        knight: 'knights'
    }
    // Actions recorded before slotKind was captured have no kind to name, so they keep
    // describing the slot by its position on the card.
    const slotLabels: Record<1 | 2 | 3, string> = { 1: 'top', 2: 'middle', 3: 'bottom' }
    function slotLabel(slot: 1 | 2 | 3, kind?: SlotKind): string {
        return kind ? slotKindLabels[kind] : slotLabels[slot]
    }
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
    <!-- Below 4 players the setup ends with castles of the shared NEUTRAL color (2 each at
         2 players, 1 each at 3 - see buildPlacementPlan), and "placed a castle" reads as
         the player's own either way. The owner isn't in the action, so it's read off the
         square: a castle never moves or changes hands once placed, so this stays right for
         every past action in the feed too. -->
    {@const placedOwner = getSquare(gameSession.gameState.board, action.castleCol, action.castleRow)
        ?.castleOwner}
    {#if placedOwner !== undefined && isNeutralOwner(placedOwner)}
        placed a neutral castle
    {:else}
        placed a castle
    {/if}
{:else if isPlaceSetupKnight(action)}
    <!-- Same reading-off-the-square trick as the castle above, and for the same reason: the
         owner is not on the action, and a setup knight never changes hands. -->
    {@const knightOwner = getSquare(gameSession.gameState.board, action.knightCol, action.knightRow)
        ?.knightOwner}
    {#if knightOwner !== undefined && isNeutralOwner(knightOwner)}
        placed the neutral castle's knight
    {:else}
        placed its knight
    {/if}
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
    {/if}{#if packRolledTo}, and the deck moved from pack {packRolledTo.from} to pack {packRolledTo.to}{/if}
{:else if isChooseAction(action)}
    chose the {slotLabel(action.slot, action.metadata?.slotKind)} action
{:else if isNegotiationMove(action)}
    {#if action.kind === NegotiationMoveKind.Propose}
        {@const executedOffer = action.metadata?.executedOffer}
        {#if executedOffer}
            {@const fromIsMe = gameSession.myPlayer?.id === executedOffer.fromPlayerId}
            accepted the proposal: <PlayerName playerId={executedOffer.fromPlayerId} />
            {fromIsMe ? 'pay' : 'pays'}
            <PlayerName playerId={executedOffer.toPlayerId} />
            {executedOffer.amount} ducat{executedOffer.amount === 1 ? '' : 's'}
        {:else}
            {@const fromIsMe = gameSession.myPlayer?.id === action.fromPlayerId}
            proposed <PlayerName playerId={action.fromPlayerId ?? ''} />
            {fromIsMe ? 'pay' : 'pays'}
            {action.amount} ducat{action.amount === 1 ? '' : 's'} for the contested action
        {/if}
    {:else if action.kind === NegotiationMoveKind.Decline}
        declined to negotiate further — forcing a duel
    {:else}
        <!-- Only reachable by a NegotiationMove whose kind predates the turn-based redesign
             (the old Sign action) - never produced going forward, but an unconditional
             {:else} above would have silently mislabeled it as a decline instead of just
             not recognizing it. -->
        took an unrecognized negotiation action
    {/if}
{:else if isSubmitDuelBid(action)}
    {#if !action.metadata?.duelResult}
        <!-- Sealed: the amount stays hidden until the bid that ends the round reveals every
             bid of that round together, so the log never tips off a player still to bid. -->
        placed a bid in the duel
    {:else}
        {@const roundBids = duelRoundEndingWith(gameSession.actions, action)}
        placed the last bid in the duel. The bids:
        {#each roundBids as bid, i (bid.id)}
            {@const treasuresUsed = bid.metadata?.treasureCardsUsed ?? []}
            {i > 0 ? (i === roundBids.length - 1 ? ' and ' : ', ') : ''}<PlayerName playerId={bid.playerId} />
            {bid.amount} ducat{bid.amount === 1 ? '' : 's'}{#if treasuresUsed.length > 0}
                {' '}+ {treasuresUsed.length === 1 ? 'a ' : ''}{#each treasuresUsed as treasureCard, j (j)}{j >
                    0
                        ? j === treasuresUsed.length - 1
                            ? ' and '
                            : ', '
                        : ''}{politicsCardLabel(treasureCard.type, treasureCard.value)}{/each} card{treasuresUsed.length ===
                1
                    ? ''
                    : 's'}
            {/if}
        {/each}
        {#if action.metadata.duelResult === 'win' && action.metadata.winnerId}
            <br /><PlayerName playerId={action.metadata.winnerId} /> won the duel
        {:else if action.metadata.duelResult === 'reduel'}
            {@const tied = action.metadata.reduelPlayerIds ?? []}
            <br />the duel was tied{#if tied.length > 0}{' '}between{' '}{#each tied as playerId, i (playerId)}{i >
                    0
                        ? i === tied.length - 1
                            ? ' and '
                            : ', '
                        : ''}<PlayerName {playerId} />{/each}{/if} — they duel again
        {:else if action.metadata.duelResult === 'giveUp'}
            <br />the second duel was tied too, so no one performs the action
        {/if}
    {/if}
{:else if isPlaceWall(action)}
    placed a wall
    {#if action.metadata?.completedRegions && action.metadata.completedRegions.length > 0}
        {#each action.metadata.completedRegions as region, i (i)}
            <!-- A semicolon rather than a line break: this is a consequence of the expansion just
                 described, so it reads as the same sentence continuing. -->
            {'; '}
            {#if region.owner}
                {@const ownerId = playerIdForOwner(region.owner)}
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
    placed a knight{#if action.metadata?.paidWithTreasureCard}, paying with a {politicsCardLabel(
            action.metadata.paidWithTreasureCard.type,
            action.metadata.paidWithTreasureCard.value
        )} card for the wooded space{:else if action.metadata?.woodedCostPaid}, paying {action.metadata.woodedCostPaid} ducats for the wooded space{/if}
{:else if isExpandRegion(action)}
    expanded a region by 1 space
    {townsPhrase(action.metadata?.townsTaken)}
    for +{action.metadata?.pointsGained ?? 0} power point{(action.metadata?.pointsGained ?? 0) === 1
        ? ''
        : 's'}
    {#if action.metadata?.invasions && action.metadata.invasions.length > 0}
        {#each action.metadata.invasions as invasion, i (i)}
            <br />
            {@const victimId = playerIdForOwner(invasion.victimOwner)}
            {#if victimId}
                <PlayerName playerId={victimId} />
            {:else}
                A neutral prince
            {/if}
            lost {invasion.directSpacesLost} space{invasion.directSpacesLost === 1 ? '' : 's'} (-{invasion.directPointsLost}
            power point{invasion.directPointsLost === 1 ? '' : 's'}){#if invasion.disconnectedSpaces > 0}, and {invasion.disconnectedSpaces} more space{invasion.disconnectedSpaces === 1
                    ? ''
                    : 's'}
            {invasion.disconnectedSpaces === 1 ? 'was' : 'were'} cut off into a neutral zone (-{invasion.disconnectedPointsLost} power point{invasion.disconnectedPointsLost ===
                1
                    ? ''
                    : 's'})
            {/if}
        {/each}
    {/if}
    {#if action.metadata?.completedRegions && action.metadata.completedRegions.length > 0}
        {#each action.metadata.completedRegions as region, i (i)}
            <br />
            {#if region.owner}
                {@const ownerId = playerIdForOwner(region.owner)}
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
    {@const victimId = playerIdForOwner(action.metadata?.victimOwner)}
    played a Renegade card — removed a knight from
    {#if victimId}
        <PlayerName playerId={victimId} />'s
    {:else}
        a neutral prince's
    {/if}
    region and placed one of their own in exchange{#if action.metadata?.removalWoodedCostPaid}, paying {action.metadata.removalWoodedCostPaid} ducats to remove it from the woods{/if}{#if action.metadata?.placementWoodedCostPaid}, paying {action.metadata.placementWoodedCostPaid} ducats to place into the woods{/if}
{:else if isPlayAllianceCard(action)}
    {@const enemyId = playerIdForOwner(action.metadata?.enemyOwner)}
    played an Alliance card — allied one of their regions with
    {#if enemyId}
        <PlayerName playerId={enemyId} />'s
    {:else}
        a neutral prince's
    {/if}
    neighboring region; neither can be expanded into the other while it lasts
{:else if isCancelAlliance(action)}
    {@const otherId = playerIdForOwner(action.metadata?.otherOwner)}
    paid 10 ducats to end an alliance with
    {#if otherId}
        <PlayerName playerId={otherId} />
    {:else}
        a neutral prince
    {/if}
{:else if isPass(action)}
    {#if action.metadata?.noLegalPlacement}
        stopped — there was nowhere legal left to place a wall
    {:else if action.metadata?.phase === 'expansion'}
        passed, declining to expand any further
    {:else if action.metadata?.phase === 'knights'}
        passed, declining to place a knight
    {:else if action.metadata?.phase === 'walls'}
        passed, declining to place another wall
    {:else}
        <!-- No phase recorded: an action from before Pass carried one. -->
        passed, declining to place any more
    {/if}
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
                    <!-- Not "3 regions": the cap is a region per castle, and the 2-player
                         variant gives each prince four (see hasEveryCastleEnclosed). -->
                    <span class="text-gray-500"
                        >— but every one of their castles is already enclosed; their turn is skipped</span
                    >
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
            {:else if meta.placementSkippedReason === 'noPoliticsCardsLeft'}
                won the {slotLabel(meta.slot!, meta.slotKind)} action
                <span class="text-gray-500">— but both politics piles are empty, so there's nothing to take</span>
            {:else}
                won the {slotLabel(meta.slot!, meta.slotKind)} action outright
            {/if}
        {:else}
            <span class="text-gray-500"
                >no one chose the {slotLabel(meta.slot!, meta.slotKind)} action</span
            >
        {/if}
    {:else if meta?.tiedPlayerIds}
        {#each meta.tiedPlayerIds as playerId, i (playerId)}
            {i > 0 ? (i === meta.tiedPlayerIds.length - 1 ? ' and ' : ', ') : ''}<PlayerName {playerId} />
        {/each}
        tied for the {slotLabel(meta.slot!, meta.slotKind)} action and {meta.tieWentToDuel
            ? 'duel for it'
            : 'enter negotiations'}
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
