<script lang="ts">
    import { m } from '$lib/paraglide/messages'
</script>

<nav class="legal-links" aria-label={m.content_legal_links_label()}>
    <a href="/privacy">{m.content_legal_links_privacy()}</a>
    <a href="/terms">{m.content_legal_links_terms()}</a>
</nav>

<style>
    .legal-links {
        display: inline-flex;
        gap: 16px;
        font-size: 13px;
    }
    a {
        color: var(--color-gray-400);
    }
    a:hover {
        color: var(--color-gray-200);
        text-decoration: underline;
        text-underline-offset: 4px;
    }
</style>
