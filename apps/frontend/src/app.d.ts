// See https://kit.svelte.dev/docs/types#app
// for information about these interfaces
declare global {
    interface BeforeInstallPromptEvent extends Event {
        readonly platforms: string[]
        readonly userChoice: Promise<{
            outcome: 'accepted' | 'dismissed'
            platform: string
        }>
        prompt(): Promise<void>
    }

    interface WindowEventMap {
        beforeinstallprompt: BeforeInstallPromptEvent
    }

    namespace App {
        // interface Error {}
        // interface Locals {}
        // interface PageData {}
        // interface Platform {}
    }
}

export {}
