<script lang="ts">
    import GuildDie from '$lib/components/pieces/GuildDie.svelte'
    import PanelRow, { type RowPointer } from '$lib/components/table/PanelRow.svelte'
    import type { PanelChoice } from '$lib/model/cardFlows.js'
    import type { DieArt } from '$lib/model/guildDie.js'

    let {
        choice,
        art,
        pointer,
        onPress,
        size = 72
    }: {
        choice: PanelChoice
        art: DieArt
        pointer: RowPointer
        onPress: (choice: PanelChoice) => void
        size?: number
    } = $props()
</script>

{#snippet piece()}
    <GuildDie guild={art.guild} rank={art.rank} {size} picked={choice.picked} caption />
{/snippet}

<PanelRow {choice} {pointer} {piece} {onPress} />
