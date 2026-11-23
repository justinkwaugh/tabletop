<script lang="ts">
    import type { Corporation } from '@tabletop/1846'
    import { CompanyToken } from '@tabletop/18xx-ui'
    import { MapView1846 } from './mapView.js'
    let {
        companies,
        size,
        removed = false
    }: { companies: readonly Corporation[]; size: number; removed?: boolean } = $props()
</script>

<!-- The catalogue's tokens, not the session's: the board draws removed homes as solid discs. -->
{#each companies as company (company.id)}<span
        class="token"
        class:removed
        style:margin-right="{size / 8}px"
        title={removed ? `${company.name} (removed)` : company.name}
        ><CompanyToken appearance={MapView1846.stations[company.id]} {size} /></span
    >{/each}

<style>
    .token {
        display: inline-block;
        vertical-align: middle;
    }
    .removed {
        opacity: 0.4;
    }
</style>
