<script lang="ts" module>
    export const CERTIFICATE_WIDTH = 32
    export const CERTIFICATE_HEIGHT = 23
</script>

<script lang="ts">
    import { companyDefinition, type CompanyId } from '@tabletop/hill-country-grocers'
    import { COMPANY_STYLE } from '$lib/utils/companyStyle.js'

    let { companyId }: { companyId: CompanyId } = $props()

    const style = $derived(COMPANY_STYLE[companyId])
</script>

<span
    class="certificate"
    style:width="{CERTIFICATE_WIDTH}px"
    style:height="{CERTIFICATE_HEIGHT}px"
    style:--company={style.fill}
    style:--company-text={style.text}
    title="{companyDefinition(companyId).name} share">{companyId}</span
>

<style>
    .certificate {
        display: inline-block;
        box-sizing: border-box;
        border: 1px solid rgba(29, 20, 11, 0.7);
        border-radius: 3px;
        background: var(--company);
        color: var(--company-text);
        font-family: 'Courier Prime', 'Courier New', monospace;
        font-size: 12px;
        font-weight: 700;
        line-height: 22px;
        text-align: center;
    }
</style>
