<script lang="ts">
    import type { BidChoice } from '@tabletop/koenigrufen'
    import BidTable from './BidTable.svelte'
    import CompactBidTable from './CompactBidTable.svelte'
    import TableMenu from './TableMenu.svelte'

    let {
        label,
        title,
        choices,
        onchoose,
        openAtOnce = false
    }: {
        label: string
        title: string
        choices: readonly BidChoice[]
        onchoose: (choice: BidChoice) => void
        openAtOnce?: boolean
    } = $props()
</script>

<TableMenu {label} {title} {openAtOnce}>
    {#snippet table({ wide, close })}
        {@const choose = (choice: BidChoice) => (close(), onchoose(choice))}
        {#if wide}
            <BidTable {choices} onchoose={choose} />
        {:else}
            <CompactBidTable {choices} onchoose={choose} />
        {/if}
    {/snippet}
</TableMenu>
