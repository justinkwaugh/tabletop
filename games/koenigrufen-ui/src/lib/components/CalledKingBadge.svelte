<script lang="ts">
    import type { CalledKing } from '@tabletop/koenigrufen'
    import KingChip from './KingChip.svelte'

    let { king }: { king: CalledKing } = $props()
</script>

<span class="called">called <KingChip {king} /></span>

<style>
    .called {
        white-space: nowrap;
    }
</style>
