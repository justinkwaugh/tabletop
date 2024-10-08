<script lang="ts">
    import collarImg from '$lib/images/collar.jpg'
    import emeraldImg from '$lib/images/emerald.jpg'
    import goldenImg from '$lib/images/golden.jpg'
    import siennaImg from '$lib/images/sienna.jpg'
    import skylineImg from '$lib/images/skyline.jpg'
    import heatherImg from '$lib/images/heather.jpg'
    import { Company } from '@tabletop/estates'

    let { company, ...others }: { company: Company } & Record<string, unknown> = $props()
    const companyImg =
        company === Company.Collar
            ? collarImg
            : company === Company.Emerald
              ? emeraldImg
              : company === Company.Golden
                ? goldenImg
                : company === Company.Sienna
                  ? siennaImg
                  : company === Company.Skyline
                    ? skylineImg
                    : heatherImg
</script>

<img src={companyImg} alt={company} {...others} />
