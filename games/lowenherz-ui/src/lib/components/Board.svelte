<script lang="ts">
    import RealBoard from './RealBoard.svelte'
    import DeckPiles from './DeckPiles.svelte'
    import ActionCardArea from './ActionCardArea.svelte'

</script>

<!-- pr-4/pb-5 are not decoration: ScalingWrapper fits the board by measuring this row's
     clientWidth/clientHeight, and those exclude filter overflow. The board frame carries
     drop-shadow-[0_6px_14px_...], so the blur reaches ~14px past its right edge and
     ~20px past its bottom (6px offset + 14px blur) - outside the measured box, and so
     clipped by the wrapper's overflow-hidden. That shaved the right edge and the bottom
     while the left and top looked fine: the deck column has nothing overhanging it, and
     the shadow's downward offset means it barely reaches above the frame at all. The
     padding brings the shadow back inside what gets measured. -->
<div class="flex items-start gap-6 pr-4 pb-5">
    <!-- Was w-56 (224px), sized for a 2x2 grid of card slots. The action deck now stacks
         into a single 106px column and the politics piles have left the table entirely,
         so this narrows to just the card width - the ~118px saved goes to the board. -->
    <div class="w-[106px] shrink-0 flex flex-col gap-4">
        <DeckPiles />
        <ActionCardArea />
    </div>
    <RealBoard />
</div>
