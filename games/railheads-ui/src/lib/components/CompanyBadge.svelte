<script lang="ts">
    import type { CompanyId } from '@tabletop/railheads'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { COMPANY_STYLE } from '$lib/utils/companyStyle.js'

    let { companyId }: { companyId: CompanyId } = $props()

    const gameSession = getGameSession()

    const style = $derived(COMPANY_STYLE[companyId])
    const definition = $derived(gameSession.gameState.companyDefinition(companyId))
</script>

<span class="badge" style:background={style.fill} style:color={style.text} title={definition.name}
    >{definition.shortName}</span
>

<style>
    .badge {
        display: inline-block;
        border-radius: 4px;
        padding: 0 5px;
        font-weight: 700;
        font-size: 0.9em;
        line-height: 1.35;
        white-space: nowrap;
    }
</style>
