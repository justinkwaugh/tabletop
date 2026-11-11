<script lang="ts">
    import documents from 'virtual:legal-documents'
    import LibraryLink from '$lib/components/project/LibraryLink.svelte'
    import { LEGAL_DOCUMENT_NAMES, type LegalDocumentKind } from '$lib/legal/legalDocumentKinds.js'

    let { kind }: { kind: LegalDocumentKind } = $props()

    let names = $derived(LEGAL_DOCUMENT_NAMES[kind])
    let html = $derived(documents[kind])
</script>

<svelte:head>
    <title>{names.title} — Board Together</title>
</svelte:head>

<main class="legal-page collection-page">
    <header class="page-heading collection-header">
        <h1 class="collection-heading">{names.title}</h1>
        <LibraryLink label="Go to the library" />
    </header>
    {#if html}
        <article class="legal-document">
            <!-- The operator writes these documents and the build bundles them; no user content. -->
            <!-- eslint-disable-next-line svelte/no-at-html-tags -->
            {@html html}
        </article>
    {:else}
        <p class="unpublished">This site hasn't published {names.unpublished} yet.</p>
    {/if}
</main>

<style>
    .legal-page {
        padding-bottom: 48px;
        color: var(--color-gray-200);
    }
    .page-heading {
        display: flex;
        align-items: center;
        justify-content: space-between;
        flex-wrap: wrap;
        gap: 12px 24px;
    }
    .unpublished {
        color: var(--color-gray-400);
    }
    .legal-document {
        max-width: 760px;
        color: var(--color-gray-300);
        font-size: 15px;
        line-height: 1.6;
    }
    .legal-document :global(h2) {
        margin: 32px 0 8px;
        font-family: 'Source Sans 3', sans-serif;
        font-size: 24px;
        font-weight: 600;
        color: var(--color-gray-100);
    }
    .legal-document :global(h3) {
        margin: 20px 0 6px;
        font-size: 16px;
        font-weight: 600;
        color: var(--color-gray-100);
    }
    .legal-document :global(p),
    .legal-document :global(ul),
    .legal-document :global(ol),
    .legal-document :global(table) {
        margin-bottom: 12px;
    }
    .legal-document :global(ul) {
        padding-left: 20px;
        list-style: disc;
    }
    .legal-document :global(ol) {
        padding-left: 20px;
        list-style: decimal;
    }
    .legal-document :global(li) {
        margin-bottom: 4px;
    }
    .legal-document :global(a) {
        color: var(--color-blue-300);
        text-decoration: underline;
        text-underline-offset: 3px;
    }
    .legal-document :global(strong) {
        color: var(--color-gray-100);
    }
    .legal-document :global(table) {
        width: 100%;
        border-collapse: collapse;
        font-size: 14px;
    }
    .legal-document :global(th),
    .legal-document :global(td) {
        padding: 6px 8px;
        border: 1px solid var(--color-gray-700);
        text-align: left;
        vertical-align: top;
    }
</style>
