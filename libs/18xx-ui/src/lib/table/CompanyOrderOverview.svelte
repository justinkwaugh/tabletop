<script lang="ts">
    import { assertExists } from '@tabletop/common'
    import type { Company } from '@tabletop/18xx'
    import type { StationAppearance } from '../maps/stationPresentation.js'
    import CompanyToken from '../tokens/CompanyToken.svelte'
    let {
        companies,
        appearances,
        firstVisible,
        lastVisible
    }: {
        companies: readonly Company[]
        appearances: Readonly<Record<string, StationAppearance>>
        firstVisible: number
        lastVisible: number
    } = $props()
    const tokens = $derived(
        companies.map((company) => {
            const appearance = appearances[company.id]
            assertExists(appearance, `Missing company appearance: ${company.id}`)
            return { id: company.id, appearance }
        })
    )
</script>

<div class="overview" aria-hidden="true">
    {#if firstVisible >= 0}
        <span
            class="visible-window"
            style:transform={`translateX(${firstVisible * 18}px)`}
            style:width={`${(lastVisible - firstVisible + 1) * 18 + 2}px`}
        ></span>
    {/if}
    {#each tokens as { id, appearance }, index (id)}
        <span
            class="mini-token"
            class:fully-visible={index >= firstVisible && index <= lastVisible}
            data-overview-company={id}
        >
            <CompanyToken {appearance} size={14} />
        </span>
    {/each}
</div>

<style>
    .overview {
        position: relative;
        display: flex;
        align-items: center;
        gap: 4px;
        padding: 3px;
        height: 20px;
    }
    .visible-window {
        position: absolute;
        left: 0;
        top: 0;
        height: 20px;
        border: 1px solid var(--rail-border, #b8a38b);
        border-radius: 6px;
        background: var(--rail-surface-raised, #f5eee4);
        transition:
            transform 100ms ease-out,
            width 100ms ease-out;
        pointer-events: none;
    }
    .mini-token {
        position: relative;
        display: flex;
        opacity: 0.45;
    }
    .mini-token.fully-visible {
        opacity: 1;
    }
    @media (prefers-reduced-motion: reduce) {
        .visible-window {
            transition: none;
        }
    }
</style>
