<script lang="ts">
    import { companyDefinition, type CompanyId } from '@tabletop/hill-country-grocers'
    import { COMPANY_STYLE } from '$lib/utils/companyStyle.js'

    let { companyId, sold = true }: { companyId: CompanyId; sold?: boolean } = $props()

    const style = $derived(COMPANY_STYLE[companyId])
</script>

<span
    class="certificate"
    class:unsold={!sold}
    style:--company={style.fill}
    style:--company-text={style.text}
    title="{companyDefinition(companyId).name} share{sold ? '' : ' (unsold)'}">{companyId}</span
>

<style>
    .certificate {
        display: inline-block;
        box-sizing: border-box;
        width: 32px;
        height: 23px;
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

    .certificate.unsold {
        border: 1.5px dashed var(--company);
        background: rgba(255, 255, 255, 0.55);
        color: var(--company);
        line-height: 20px;
        opacity: 0.6;
    }
</style>
