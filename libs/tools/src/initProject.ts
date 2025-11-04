import WebPush from 'web-push'
import fs from 'fs/promises'

async function replaceFileString(toReplace: string, replaceWith: string, fileName: string) {
    let fileContent = await fs.readFile(fileName, 'utf8')
    fileContent = fileContent.replace(new RegExp(toReplace, 'g'), replaceWith)
    await fs.writeFile(fileName, fileContent, 'utf8')
}

async function fileExists(path: string): Promise<boolean> {
    try {
        await fs.access(path)
        console.log('File exists.')
        return true
    } catch (error) {
        console.log('File does not exist.')
        return false
    }
}

export const initProject = async () => {
    try {
        // Go to root
        process.chdir('../../')

        const exists = await fileExists('apps/backend/.env.local')
        if (exists) {
            console.log(
                `It looks like your project has already been initialized. If you want to re-initialize, please delete apps/backend/.env.local and apps/frontend/.env.development.local and run this script again.`
            )
            return
        }

        console.log(`Generating VAPID keys for Web Push notifications...`)
        const vapidKeys = WebPush.generateVAPIDKeys()
        console.log(`VAPID Public Key: ${vapidKeys.publicKey}`)
        console.log(`VAPID Private Key: ${vapidKeys.privateKey}`)

        // Copy env files
        console.log(`Copying backend .env.example to .env.local...`)
        await fs.copyFile('apps/backend/.env.example', 'apps/backend/.env.local')

        console.log(`Copying frontend .env.example to .env.development.local...`)
        await fs.copyFile('apps/frontend/.env.example', 'apps/frontend/.env.development.local')

        await fs.copyFile('apps/frontend/.env.example', 'apps/frontend/.env.production')

        console.log(`Updating .env files with generated VAPID keys...`)
        await replaceFileString(
            'VAPID_PUBLIC_KEY=',
            `VAPID_PUBLIC_KEY="${vapidKeys.publicKey}"`,
            'apps/backend/.env.local'
        )
        await replaceFileString(
            'VAPID_PRIVATE_KEY=',
            `VAPID_PRIVATE_KEY="${vapidKeys.privateKey}"`,
            'apps/backend/.env.local'
        )

        await replaceFileString(
            'PUBLIC_VAPID_KEY=',
            `PUBLIC_VAPID_KEY="${vapidKeys.publicKey}"`,
            'apps/frontend/.env.development.local'
        )

        console.log(`Generating session secret and salt...`)
        // generate random string that is 40 characters long
        const sessionSecret = [...Array(40)]
            .map(() => Math.random().toString(36)[2] || '0')
            .join('')
        const sessionSalt = [...Array(16)].map(() => Math.random().toString(36)[2] || '0').join('')

        console.log(`Updating .env files with generated session secret and salt...`)
        await replaceFileString(
            'SESSION_SECRET=',
            `SESSION_SECRET="${sessionSecret}"`,
            'apps/backend/.env.local'
        )
        await replaceFileString(
            'SESSION_SALT=',
            `SESSION_SALT="${sessionSalt}"`,
            'apps/backend/.env.local'
        )

        console.log(`Done! Your project has been initialized.`)
    } catch (error) {
        // And of course, make sure you catch and log any errors!
        console.error(error)
    }
}

await (async () => {
    await initProject()
})()
