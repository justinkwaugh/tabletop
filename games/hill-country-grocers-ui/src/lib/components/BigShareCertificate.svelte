<script lang="ts">
    import { companyDefinition, type CompanyId } from '@tabletop/hill-country-grocers'
    import { COMPANY_STYLE } from '$lib/utils/companyStyle.js'

    let {
        companyId,
        choice
    }: { companyId: CompanyId; choice?: { label: string; onclick: () => void } } = $props()

    const style = $derived(COMPANY_STYLE[companyId])
    const definition = $derived(companyDefinition(companyId))
</script>

{#if choice}
    <button
        type="button"
        class="certificate choosable"
        style:--company={style.fill}
        style:--company-text={style.text}
        aria-label={choice.label}
        onclick={choice.onclick}
    >
        <span class="code">{companyId}</span>
        <span class="name">{definition.shortName}</span>
    </button>
{:else}
    <div
        class="certificate"
        style:--company={style.fill}
        style:--company-text={style.text}
        title="{definition.name} share"
    >
        <span class="code">{companyId}</span>
        <span class="name">{definition.shortName}</span>
    </div>
{/if}

<style>
    .certificate {
        display: inline-flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        box-sizing: border-box;
        width: 108px;
        height: 58px;
        border: 1px solid rgba(29, 20, 11, 0.7);
        border-radius: 3px;
        background: var(--company);
        box-shadow:
            inset 0 0 0 3px var(--company),
            inset 0 0 0 4px rgba(255, 255, 255, 0.65);
        color: var(--company-text);
    }

    .code {
        font-family: 'Courier Prime', 'Courier New', monospace;
        font-size: 21px;
        font-weight: 700;
        letter-spacing: 0.12em;
        line-height: 1.1;
    }

    .name {
        font-family: 'Libre Baskerville', Georgia, serif;
        font-size: 11px;
        font-style: italic;
    }

    .choosable {
        cursor: pointer;
        transition:
            transform 120ms ease,
            box-shadow 120ms ease;
    }

    .choosable:hover,
    .choosable:focus-visible {
        outline: none;
        transform: translateY(-2px);
        box-shadow:
            inset 0 0 0 3px var(--company),
            inset 0 0 0 4px rgba(255, 255, 255, 0.65),
            0 0 0 2px #c8961a,
            0 3px 6px rgba(43, 26, 16, 0.3);
    }
</style>
