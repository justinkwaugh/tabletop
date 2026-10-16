<script lang="ts">
    import type { CompanyId } from '@tabletop/railheads'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { COMPANY_STYLE, shareLabel } from '$lib/utils/companyStyle.js'

    let {
        companyId,
        label,
        onclick
    }: { companyId: CompanyId; label: string; onclick: () => void } = $props()

    const gameSession = getGameSession()

    const style = $derived(COMPANY_STYLE[companyId])
    const definition = $derived(gameSession.gameState.companyDefinition(companyId))
    const home = $derived(gameSession.gameState.edition.site(definition.homeSiteId).name)
</script>

<button
    type="button"
    class="certificate"
    style:--co={style.fill}
    style:--co-text={style.text}
    aria-label={label}
    title={definition.name}
    {onclick}
>
    <span class="code">{shareLabel(definition.shortName)}</span>
    <span class="home">{home}</span>
</button>

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
        background: var(--co);
        box-shadow:
            inset 0 0 0 3px var(--co),
            inset 0 0 0 4px rgba(255, 255, 255, 0.65);
        color: var(--co-text);
        cursor: pointer;
        transition:
            transform 120ms ease,
            box-shadow 120ms ease;
    }

    .certificate:hover,
    .certificate:focus-visible {
        outline: none;
        transform: translateY(-2px);
        box-shadow:
            inset 0 0 0 3px var(--co),
            inset 0 0 0 4px rgba(255, 255, 255, 0.65),
            0 0 0 2px #c8961a,
            0 3px 6px rgba(43, 26, 16, 0.3);
    }

    .code {
        font-family: 'Libre Baskerville', Georgia, serif;
        font-size: 17px;
        font-weight: 700;
        letter-spacing: 0.06em;
        line-height: 1.15;
    }

    .home {
        font-family: 'Libre Baskerville', Georgia, serif;
        font-size: 11px;
        font-style: italic;
    }

    @media (max-width: 639px) {
        .certificate {
            width: 92px;
            height: 50px;
        }

        .code {
            font-size: 15px;
        }
    }
</style>
