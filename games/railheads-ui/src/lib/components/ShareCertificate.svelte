<script lang="ts" module>
    export const CERTIFICATE_WIDTH = 46
    export const CERTIFICATE_HEIGHT = 19
</script>

<script lang="ts">
    import type { CompanyId } from '@tabletop/railheads'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { COMPANY_STYLE, shareLabel } from '$lib/utils/companyStyle.js'

    let { companyId, labelled = true }: { companyId: CompanyId; labelled?: boolean } = $props()

    const gameSession = getGameSession()

    const style = $derived(COMPANY_STYLE[companyId])
    const definition = $derived(gameSession.gameState.companyDefinition(companyId))
</script>

<span
    class="certificate"
    style:width="{CERTIFICATE_WIDTH}px"
    style:height="{CERTIFICATE_HEIGHT}px"
    style:--co={style.fill}
    style:--co-text={style.text}
    title="{definition.name} share">{labelled ? shareLabel(definition.shortName) : ''}</span
>

<style>
    .certificate {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        box-sizing: border-box;
        border-radius: 2px;
        background: var(--co);
        color: var(--co-text);
        font-family: 'Libre Baskerville', Georgia, serif;
        font-size: 9px;
        letter-spacing: -0.03em;
        font-weight: 700;
        white-space: nowrap;
        box-shadow:
            inset 0 0 0 1.5px rgba(255, 255, 255, 0.55),
            0 0 0 1px rgba(0, 0, 0, 0.35);
    }
</style>
