<script lang="ts">
    import CertificateBadge from './CertificateBadge.svelte'
    let { label = 'P' }: { label?: string } = $props()
</script>

<CertificateBadge
    {label}
    title={label === 'P' ? 'President' : `President, ${label.slice(1)} shares`}
/>
