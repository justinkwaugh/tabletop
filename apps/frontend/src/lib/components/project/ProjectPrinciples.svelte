<script lang="ts">
    import RichMessage from '$lib/components/RichMessage.svelte'
    import { m } from '$lib/paraglide/messages'
</script>

{#snippet strong(text: string)}<strong>{text}</strong>{/snippet}

<ul class="principles" aria-label={m.content_principles_label()}>
    <li><RichMessage parts={m.content_principles_free.parts()} markup={{ strong }} /></li>
    <li><RichMessage parts={m.content_principles_open_source.parts()} markup={{ strong }} /></li>
</ul>

<style>
    .principles {
        display: grid;
        gap: 12px;
        padding-left: 28px;
        border-left: 2px solid var(--color-highlight-border);
        font-family: 'Source Sans 3', sans-serif;
        font-size: 21px;
        line-height: 1.4;
    }
    .principles strong {
        font-weight: 600;
    }
    @media (max-width: 700px) {
        .principles {
            font-size: 18px;
            padding-left: 16px;
            gap: 6px;
        }
    }
</style>
