<script lang="ts">
    import { assertExists } from '@tabletop/common'
    import type { Company } from '@tabletop/18xx'
    import type { StationAppearance } from '../maps/stationPresentation.js'
    import CompanyToken from '../tokens/CompanyToken.svelte'
    let {
        companies,
        appearances,
        firstVisible,
        lastVisible,
        completedCompanyIds = [],
        currentCompanyId
    }: {
        companies: readonly Company[]
        appearances: Readonly<Record<string, StationAppearance>>
        firstVisible: number
        lastVisible: number
        completedCompanyIds?: readonly string[]
        currentCompanyId?: string
    } = $props()
    const tokenSize = 21
    const tokenGap = 6
    const inset = 4
    const tokenStep = tokenSize + tokenGap
    const tokens = $derived(
        companies.map((company) => {
            const appearance = appearances[company.id]
            assertExists(appearance, `Missing company appearance: ${company.id}`)
            return { id: company.id, appearance }
        })
    )
</script>

<div
    class="overview"
    aria-hidden="true"
    style:gap={`${tokenGap}px`}
    style:padding={`${inset}px`}
    style:height={`${tokenSize + 2 * inset}px`}
>
    {#if firstVisible >= 0}
        <span
            class="visible-window"
            style:transform={`translateX(${firstVisible * tokenStep}px)`}
            style:width={`${(lastVisible - firstVisible + 1) * tokenStep - tokenGap + 2 * inset}px`}
        ></span>
    {/if}
    {#each tokens as { id, appearance }, index (id)}
        <span
            class="mini-token"
            class:outside-window={firstVisible >= 0 &&
                (index < firstVisible || index > lastVisible)}
            class:completed={completedCompanyIds.includes(id)}
            class:current={currentCompanyId === id}
            data-overview-company={id}
        >
            <CompanyToken {appearance} size={tokenSize} />
        </span>
    {/each}
</div>

<style>
    .overview {
        position: relative;
        display: flex;
        align-items: center;
    }
    .visible-window {
        position: absolute;
        left: 0;
        top: 0;
        height: 100%;
        border: 1px solid var(--rail-border, #b8a38b);
        border-radius: 8px;
        background: var(--rail-surface-raised, #f5eee4);
        transition:
            transform 100ms ease-out,
            width 100ms ease-out;
        pointer-events: none;
    }
    .mini-token {
        position: relative;
        display: flex;
    }
    .mini-token.outside-window {
        opacity: 0.45;
    }
    .mini-token.current {
        border-radius: 50%;
        outline: 2px solid var(--rail-text, #5e4937);
        outline-offset: 2px;
    }
    .mini-token.completed {
        filter: grayscale(1) brightness(0.75);
    }
    @media (prefers-reduced-motion: reduce) {
        .visible-window {
            transition: none;
        }
    }
</style>
