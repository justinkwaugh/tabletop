<script lang="ts">
    import type { Snippet } from 'svelte'

    let { title, children }: { title: string; children: Snippet } = $props()
</script>

<section
    aria-label={title}
    class="aid-card w-[250px] shrink-0 overflow-hidden rounded-[10px] border-2 border-[#6b4f30] text-left text-[13px] leading-snug text-[#3d2f1f]"
>
    <h2
        class="aid-title marracash-initial border-b-2 border-[#6b4f30] px-2.5 pt-[7px] pb-1.5 text-center text-base tracking-[0.08em] text-[#f8ecd2] uppercase"
    >
        {title}
    </h2>
    <div class="px-3 pt-2 pb-2.5">
        {@render children()}
    </div>
</section>

<style>
    .aid-card {
        background-color: #f4ead6;
        background-image:
            radial-gradient(ellipse at 15% 8%, rgba(255, 255, 255, 0.6), transparent 55%),
            radial-gradient(ellipse at 90% 92%, rgba(138, 106, 70, 0.16), transparent 60%);
        box-shadow:
            0 12px 28px rgba(0, 0, 0, 0.45),
            inset 0 0 0 3px #f4ead6,
            inset 0 0 0 4px rgba(138, 106, 70, 0.45);
    }

    .aid-title {
        background-image: linear-gradient(180deg, #a5502f 0%, #8a3d26 60%, #74311d 100%);
        text-shadow: 0 1px 2px rgba(0, 0, 0, 0.45);
    }

    .aid-card :global(.aid-heading) {
        margin: 9px 0 3px;
        font-family: 'Libre Caslon Text', Georgia, serif;
        font-weight: 700;
        font-size: 12px;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: #6b4f30;
    }

    .aid-card :global(.aid-heading:first-child) {
        margin-top: 0;
    }

    .aid-card :global(.aid-lead) {
        margin-bottom: 2px;
        font-size: 11px;
        font-style: italic;
        color: #5a4630;
    }

    .aid-card :global(.aid-table) {
        width: 100%;
        border-collapse: collapse;
    }

    .aid-card :global(.aid-table th) {
        padding: 0 4px 3px;
        border-bottom: 1px solid rgba(107, 79, 48, 0.45);
        font-family: 'Libre Caslon Text', Georgia, serif;
        font-weight: 700;
        font-size: 10.5px;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        text-align: left;
        color: #6b4f30;
    }

    .aid-card :global(.aid-table td) {
        padding: 3px 4px;
        border-top: 1px solid rgba(107, 79, 48, 0.15);
    }

    .aid-card :global(.aid-table tr:nth-child(even) td) {
        background: rgba(107, 79, 48, 0.05);
    }

    .aid-card :global(.aid-gain) {
        font-family: 'Libre Caslon Text', Georgia, serif;
        font-weight: 700;
        font-size: 14px;
        color: #2e6b34;
    }
</style>
