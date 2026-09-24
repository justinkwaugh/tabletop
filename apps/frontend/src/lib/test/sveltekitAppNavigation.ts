// Stand-in for SvelteKit's `$app/navigation` in client-mode Vitest runs, which don't load the
// SvelteKit plugin. Specs that assert on navigation override it with vi.mock.
export async function goto(): Promise<void> {}
export async function invalidateAll(): Promise<void> {}
export function afterNavigate(): void {}
export function onNavigate(): void {}
