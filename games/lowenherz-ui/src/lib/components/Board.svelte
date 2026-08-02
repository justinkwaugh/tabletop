<script lang="ts">
    import RealBoard from './RealBoard.svelte'
    import DeckPiles from './DeckPiles.svelte'
    import ActionCardArea from './ActionCardArea.svelte'

    // RealBoard's status/instruction text sits above its actual board frame and
    // grows/shrinks with game state, so the frame's top edge isn't a fixed offset
    // from the top of this row - RealBoard measures it live and reports it here so
    // the deck piles can be nudged down to match, keeping their tops level with the
    // board frame instead of the top of RealBoard's whole column.
    let frameOffset = $state(0)
</script>

<div class="flex items-start gap-6">
    <div class="w-56 shrink-0 flex flex-col gap-4" style="padding-top: {frameOffset}px">
        <DeckPiles />
        <ActionCardArea />
    </div>
    <RealBoard onFrameOffset={(px) => (frameOffset = px)} />
</div>
