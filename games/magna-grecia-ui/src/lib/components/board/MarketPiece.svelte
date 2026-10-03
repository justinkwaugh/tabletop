<script lang="ts">
    import CrateArt, { type CrateState } from './CrateArt.svelte'

    let {
        color,
        sold = false,
        active = true
    }: { color: string; sold?: boolean; active?: boolean } = $props()

    const state: CrateState = $derived(sold ? 'sold' : active ? 'full' : 'empty')
</script>

<g filter="url(#mg-piece-outline)">
    <CrateArt {color} {state} />
</g>
