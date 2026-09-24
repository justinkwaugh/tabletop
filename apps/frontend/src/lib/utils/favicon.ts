export type FaviconVariant = 'favicon' | 'favicon-turn'

export function showFaviconVariant(variant: FaviconVariant) {
    for (const icon of document.querySelectorAll<HTMLLinkElement>('link[rel="icon"][sizes]')) {
        icon.href = `/${variant}-${icon.getAttribute('sizes')}.png`
    }
}
