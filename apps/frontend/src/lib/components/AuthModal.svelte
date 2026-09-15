<script lang="ts">
    import { Modal } from 'flowbite-svelte'
    import type { Snippet } from 'svelte'

    let {
        open = $bindable(false),
        title,
        label = title,
        variant = 'welcome',
        oncancel,
        children
    }: {
        open?: boolean
        title: string
        label?: string
        variant?: 'welcome' | 'form'
        oncancel?: () => void
        children: Snippet
    } = $props()

    function close(event: Event) {
        if (event.currentTarget instanceof HTMLDialogElement) {
            event.currentTarget.close()
        }
        oncancel?.()
    }
</script>

<Modal
    bind:open
    {title}
    aria-label={label}
    class={`auth-modal backdrop:bg-black/70 dark:bg-gray-900 divide-y-0 border border-highlight-border dark:border-highlight-border ${variant === 'form' ? 'w-[calc(100%_-_2rem)]' : ''}`}
    classes={{
        header:
            variant === 'form'
                ? 'text-2xl max-[360px]:text-xl sm:text-[28px] px-6 pt-6 pb-2 md:px-6 md:pt-6 md:pb-2'
                : 'text-4xl pb-2 md:pb-3',
        body: variant === 'form' ? 'px-6 pt-3 pb-6 md:px-6 md:pt-3 md:pb-6' : undefined,
        close: 'min-[701px]:hidden'
    }}
    size="xs"
    transitionParams={{ duration: 0 }}
    outsideclose
    oncancel={close}
>
    {@render children()}
</Modal>

<style>
    :global(.auth-modal h3) {
        font-family: 'Inter', sans-serif;
        font-weight: 700;
        letter-spacing: -0.025em;
        line-height: 1.2;
    }

    :global(.auth-modal label) {
        font-size: 13px;
        font-weight: 600;
        letter-spacing: 0.015em;
    }

    :global(.auth-modal input) {
        font-size: 16px;
        font-weight: 400;
        line-height: 1.5;
    }

    :global(.auth-modal button[type='submit']),
    :global(.auth-modal a) {
        font-weight: 600;
    }

    :global(.auth-modal .auth-secondary) {
        font-size: 13px;
        line-height: 1.5;
    }

    :global(.dark .auth-modal .auth-secondary) {
        color: var(--color-gray-400);
    }
</style>
