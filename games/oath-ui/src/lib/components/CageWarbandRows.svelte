<script lang="ts">
    import { IMPERIAL_WARBANDS, type WarbandGroup } from '@tabletop/oath'
    import WarbandGroupRows from '$lib/components/WarbandGroupRows.svelte'

    // R-10.13-H1 — the Obsidian Cage sent down: its Imperial warbands, one row of pieces per
    // Imperial board they may go to, in the Cage Action's own rows. Fae Merchant's step and the
    // victory's step after Relic Hunter's relics both ask it.
    let {
        boards,
        total,
        counts,
        ceilingAt,
        onpick
    }: {
        boards: readonly string[]
        total: number
        counts: readonly number[]
        ceilingAt: (row: number) => number
        onpick: (row: number, count: number) => void
    } = $props()

    let groups: WarbandGroup[] = $derived(
        boards.map((playerId) => ({
            at: { kind: 'board', playerId },
            owner: IMPERIAL_WARBANDS,
            count: total
        }))
    )
</script>

<WarbandGroupRows {groups} {counts} {ceilingAt} {onpick} tone="gold" toward ownerWord={false} />
