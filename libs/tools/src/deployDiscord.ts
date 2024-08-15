import { REST, Routes } from 'discord.js'
import { NotifyCommand, StopCommand } from '@tabletop/backend-services'

const { token, clientId } = {
    clientId: process.env.DISCORD_CLIENT_ID ?? '',
    token: process.env.DISCORD_BOT_TOKEN ?? ''
}

// Construct and prepare an instance of the REST module
const rest = new REST().setToken(token)

// and deploy your commands!
export const deployDiscord = async () => {
    try {
        console.log(`Started refreshing application (/) commands.`)

        // The put method is used to fully refresh all commands in the guild with the current set
        const data = await rest.put(Routes.applicationCommands(clientId), {
            body: [NotifyCommand.toJSON(), StopCommand.toJSON()]
        })

        console.log(`Successfully reloaded application (/) commands.`, data)
    } catch (error) {
        // And of course, make sure you catch and log any errors!
        console.error(error)
    }
}

await (async () => {
    await deployDiscord()
})()
