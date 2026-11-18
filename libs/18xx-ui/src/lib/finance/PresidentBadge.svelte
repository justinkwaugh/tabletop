<script lang="ts">
    import CertificateBadge from './CertificateBadge.svelte'
    let { label, title }: { label: string; title: string } = $props()
    const shares = $derived(label.slice(1))
</script>

<CertificateBadge {label} title={shares ? `${title}, ${shares} shares` : title} />
