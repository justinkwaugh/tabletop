<script lang="ts">
    import type { Corporation } from '@tabletop/1846'
    import { CompanyToken, initialToken } from '@tabletop/18xx-ui'
    import { MapView1846 } from './mapView.js'
    let {
        companies,
        size,
        removed = false,
        initials
    }: {
        companies: readonly Corporation[]
        size: number
        removed?: boolean
        initials: boolean
    } = $props()
</script>

<!-- The catalogue's tokens, not the session's: the board draws removed homes as solid discs. -->
{#each companies as company (company.id)}<span
        class="token"
        class:removed
        style:margin-right="{size / 8}px"
        title={removed ? `${company.name} (removed)` : company.name}
        ><CompanyToken
            appearance={initials
                ? initialToken(MapView1846.stations[company.id])
                : MapView1846.stations[company.id]}
            {size}
        /></span
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
