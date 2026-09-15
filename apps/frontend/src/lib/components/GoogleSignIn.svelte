<script module lang="ts">
    import { PUBLIC_GOOGLE_CLIENT_ID } from '$env/static/public'
    export const isEnabled: boolean = !!PUBLIC_GOOGLE_CLIENT_ID
</script>

<script lang="ts">
    import { onMount } from 'svelte'
    import { isLibraryLoaded, markLibraryLoaded } from '$lib/stores/libraryLoaded.svelte'
    import { getAppContext } from '@tabletop/frontend-components'

    let { mode = 'login' }: { mode: 'link' | 'login' } = $props()

    let { authorizationService, api } = getAppContext()

    const LIBRARY_ID = 'google-sign-in'

    let mounted = $state(false)
    let initialized = $state(false)
    let buttonElement: HTMLDivElement | undefined = $state()
    let buttonWidth = $state(0)
    const targetWidth = $derived(mode === 'login' ? Math.min(400, Math.floor(buttonWidth)) : 100)
    async function setupGoogleSignin() {
        if (initialized) {
            return
        }
        initialized = true
        const handleCredentialResponse = async (response: any) => {
            if (response.credential) {
                if (mode === 'login') {
                    const user = await api.loginGoogle(response.credential)
                    await authorizationService.onLogin(user)
                } else if (mode === 'link') {
                    const user = await api.linkGoogle(response.credential)
                    authorizationService.setSessionUser(user)
                }
            }
        }

        google.accounts.id.initialize({
            client_id: PUBLIC_GOOGLE_CLIENT_ID,
            callback: handleCredentialResponse
        })
    }

    $effect(() => {
        if (initialized && buttonElement && targetWidth > 0) {
            buttonElement.innerHTML = ''
            google.accounts.id.renderButton(buttonElement, {
                type: 'standard',
                theme: 'outline',
                size: mode === 'login' ? 'large' : 'medium',
                text: mode === 'login' ? 'signin_with' : 'signin',
                shape: 'pill',
                logo_alignment: 'left',
                width: targetWidth
            })
        }
    })

    function onGoogleLibraryLoaded() {
        markLibraryLoaded(LIBRARY_ID)
        if (mounted) {
            setupGoogleSignin()
        }
    }

    onMount(() => {
        mounted = true
        if (isLibraryLoaded(LIBRARY_ID)) {
            setupGoogleSignin()
        }
    })
</script>

<div class={mode === 'login' ? 'google-signin-wrapper login' : 'google-signin-wrapper'}>
    <div
        bind:this={buttonElement}
        bind:clientWidth={buttonWidth}
        class="google-sign-in-button"
    ></div>
    <script
        src="https://accounts.google.com/gsi/client"
        onload={onGoogleLibraryLoaded}
        async
        defer
    ></script>
</div>

<style>
    .google-sign-in-button {
        height: 44px;
        width: auto;
    }

    .google-signin-wrapper.login .google-sign-in-button {
        width: 100%;
    }
</style>
