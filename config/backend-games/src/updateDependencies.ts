import PackageJson from '@npmcli/package-json'
import { AvailableGames } from '@tabletop/games-config'

async function updateDependencies(): Promise<void> {
    try {
        const pkgJson = await PackageJson.load('.')
        const dependencies = AvailableGames.map(([name, scope]) => {
            return scope ? `${scope}/${name}` : `${name}`
        })
        const dependencyMap = dependencies.reduce(
            (acc, dep) => {
                acc[dep] = '*'
                return acc
            },
            {} as Record<string, string>
        )
        console.log('Updating backend game dependencies to:', dependencyMap)
        pkgJson.update({
            dependencies: dependencyMap
        })

        await pkgJson.save()
        console.log('Dependencies updated successfully.')
    } catch (error) {
        console.error('Error updating package.json:', error)
    }
}

await (async () => {
    await updateDependencies()
})()
