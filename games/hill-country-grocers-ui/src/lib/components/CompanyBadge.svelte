<script lang="ts">
    import { companyDefinition, type CompanyId } from '@tabletop/hill-country-grocers'
    import { COMPANY_STYLE } from '$lib/utils/companyStyle.js'

    let { companyId, full }: { companyId: CompanyId; full?: boolean } = $props()

    const style = $derived(COMPANY_STYLE[companyId])
    const definition = $derived(companyDefinition(companyId))
</script>

<span class="badge" style:background={style.fill} style:color={style.text} title={definition.name}
    >{full ? definition.name : definition.shortName}</span
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
