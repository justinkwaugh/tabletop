<script lang="ts">
    import { WaterfallAuctionPanel, type EighteenXXSession } from '@tabletop/18xx-ui'
    let { session, showUndo = true }: { session: EighteenXXSession; showUndo?: boolean } =
        $props()
</script>

{#if session.waterfall.model && !session.waterfall.model.auction.completed}
    <WaterfallAuctionPanel
        model={session.waterfall.model}
        playerId={session.myPlayer?.id}
        playerName={(id) => session.getPlayerName(id)}
        disabled={!session.waterfall.canAct}
        selection={session.waterfall.selection}
        onChoose={(kind, lotId) => session.waterfall.selectLot(kind, lotId)}
        onBidChange={(amount) => session.waterfall.setBid(amount)}
        onConfirm={() => session.waterfall.confirm()}
        onBack={() => session.waterfall.choice.clear()}
        onPass={() => session.waterfall.pass()}
        onUndo={() => session.undo()}
        {showUndo}
        canUndo={!session.busy &&
            !session.isViewingHistory &&
            Boolean(session.waterfall.selection || session.undoableAction)}
    />
{/if}
