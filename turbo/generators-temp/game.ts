import type { PlopTypes } from '@turbo/gen'
export default function generator(plop: PlopTypes.NodePlopAPI): void {
    // create a generator
    plop.setGenerator('create-game', {
        description: 'Add a new game',
        // gather information from the user
        prompts: [
            {
                type: 'input',
                name: 'game',
                message: "Game name (e.g., 'Go Fish'):"
            }
        ],
        // perform actions based on the prompts
        actions: [
            {
                type: 'addMany',
                destination: 'games/{{lowerCase game}}/src',
                base: `templates/game/logic`,
                templateFiles: `templates/game/logic/*.hbs`
            }
        ]
    })
}
