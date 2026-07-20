<script lang="ts">
    import BoardTiles from '$lib/components/BoardTiles.svelte'
    import DeckArea from '$lib/components/DeckArea.svelte'
    import RampartBorder from '$lib/components/RampartBorder.svelte'
    import RampartCorner from '$lib/components/RampartCorner.svelte'
    import parchmentTexture from '$lib/images/board/parchment-texture.png'
</script>

<div class="p-6 bg-stone-900 min-h-screen">
    <h1 class="text-stone-200 text-xl mb-4">Board layout preview</h1>
    <div
        class="max-w-4xl p-10"
        style="background-image: url({parchmentTexture}); background-repeat: repeat;"
    >
        <DeckArea />
        <div class="grid" style="grid-template-columns: 20px 1fr 20px; grid-template-rows: 20px 1fr 20px;">
            <RampartCorner />
            <div><RampartBorder side="top" /></div>
            <RampartCorner />

            <div><RampartBorder side="left" /></div>
            <div><BoardTiles /></div>
            <div><RampartBorder side="right" /></div>

            <RampartCorner />
            <div><RampartBorder side="bottom" /></div>
            <RampartCorner />
        </div>
    </div>
</div>
