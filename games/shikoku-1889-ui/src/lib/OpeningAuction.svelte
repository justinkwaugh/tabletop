<script lang="ts">
    import { WaterfallAuctionPanel, type EighteenXXSession } from '@tabletop/18xx-ui'
    let { session, showUndo = true }: { session: EighteenXXSession; showUndo?: boolean } =
        $props()
</script>

{#if session.auction && !session.auction.auction.completed}
    <WaterfallAuctionPanel
        model={session.auction}
        playerId={session.myPlayer?.id}
        playerName={(id) => session.getPlayerName(id)}
        disabled={!session.canAuction}
        draft={session.auctionSelection}
        onChoose={(kind, lotId) => session.selectAuctionLot(kind, lotId)}
        onBidChange={(amount) => session.setAuctionBid(amount)}
        onConfirm={() => session.confirmAuction()}
        onBack={() => session.backAuction()}
        onPass={() => session.passAuction()}
        onUndo={() => session.undo()}
        {showUndo}
        canUndo={!session.busy &&
            !session.isViewingHistory &&
            Boolean(session.auctionSelection || session.undoableAction)}
    />
{/if}
