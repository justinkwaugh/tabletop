<script lang="ts">
    import { CARD_COLUMN_WIDTH, scaled } from '$lib/model/boardMetrics.js'
    import RealBoard from './RealBoard.svelte'
    import DeckPiles from './DeckPiles.svelte'
    import ActionCardArea from './ActionCardArea.svelte'

</script>

<!-- pt-3/pr-4/pb-5 are not decoration: ScalingWrapper fits the board by measuring this
     row's clientWidth/clientHeight, and those exclude filter overflow. The board frame
     carries drop-shadow-[0_6px_14px_...], so the blur reaches ~14px past its right edge
     and ~20px past its bottom (6px offset + 14px blur) - outside the measured box, and so
     clipped by the wrapper's overflow-hidden. The padding brings the overflow back inside
     what gets measured.

     The top needed nothing until the status text moved out to GameTable. The shadow's
     upward reach is only ~8px (14px blur less the 6px downward offset), and it used to
     land harmlessly in the space the instruction text occupied above the frame. With that
     text gone the frame is this row's first thing, so those 8px hang outside the measured
     box and the top edge gets shaved - which is what "the top looked fine" in the note
     above depended on and no longer does. pt-3 (12px) also covers the 4px ring drawn
     around a selected castle square, which is a box-shadow and equally uncounted. -->
<div
    class="flex items-start"
    style="gap: {scaled(24)}px; padding: {scaled(12)}px {scaled(16)}px {scaled(20)}px 0;"
>
    <!-- Was w-56 (224px), sized for a 2x2 grid of card slots. The action deck now stacks
         into a single 106px column and the politics piles have left the table entirely,
         so this narrows to just the card width - the ~118px saved goes to the board. -->
    <div class="shrink-0 flex flex-col gap-4" style="width: {CARD_COLUMN_WIDTH}px;">
        <DeckPiles />
        <ActionCardArea />
    </div>
    <RealBoard />
</div>
