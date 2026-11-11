/**
 * The publisher's cover in the asset folder (`cover` in the asset map), or undefined when the
 * folder holds none. It has its own glob so the UI entry, which the site loads to list its
 * library, carries neither the asset map nor the logic tables the map is built from.
 */
const files = import.meta.glob<string>('./supplied/cover.{webp,png}', {
    eager: true,
    import: 'default'
})

export const suppliedCover: string | undefined =
    files['./supplied/cover.webp'] ?? files['./supplied/cover.png']
