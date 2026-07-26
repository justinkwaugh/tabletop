<script lang="ts">
    import RealBoard from './RealBoard.svelte'
    import DeckPiles from './DeckPiles.svelte'
    import ActionCardArea from './ActionCardArea.svelte'
    import PoliticsCardArea from './PoliticsCardArea.svelte'
</script>

<div class="flex items-start gap-6">
    <div class="w-56 shrink-0 flex flex-col gap-4">
        <DeckPiles />
        <ActionCardArea />
        <PoliticsCardArea />
    </div>
    <RealBoard />
</div>
