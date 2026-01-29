# Tabletop

This project is an open source website for online boardgames. It has a dual intent of both being the implementation of a website for people to get together to play games, but also to serve as an open source example of a full featured website which can be hosted easily and cheaply. It is comprised of several parts, namely a backend which runs on Node with Fastify as a web server, and a frontend which uses the Svelte/Sveltekit framework as an SPA (Single Page Application), as well as independent game implementations used by both.

The project is served at [Board Together](https://boardtogether.games), which is currently running on Cloud Run using Cloud Firestore as a database as well as a few other services described later in this document.

## Project organization

The project is setup as a monorepo using [npm workspaces](https://docs.npmjs.com/cli/v8/using-npm/workspaces) and [Turbo](https://turbo.build) to aid in rapid compilation and development. The workspaces are organized as follows:

```
/apps
|--/backend - the Node/Fastify based API
|--/frontend - the Svelte/Sveltekit website SPA
/games
|--/fresh-fish - The state / state handlers / actions for Fresh Fish
|--/fresh-fish-ui - The Svelte UI for Fresh Fish
/libs
|--/backend-services - A variety of services used by the backend
|--/common - Shared game engine objects and types
|--/config-eslint - Shared eslint config
|--/config-games - A module used to define which games/versions are available
|--/config-rollup - Shared rollup config for bundling game UIs
|--/config-vitest - Shared vitest config
|--/email - React Email project for email editing / previewing
|--/frontend-components - Shared frontend components
/tools
|--/deploy - A TUI for deployment to GCP
|--/scripts - Some useful scripts
```

The frontend is run as a separate Vite process during development but for deployment is compiled into a static SPA and served by the backend. Game implementations are modular and could even be imported from external repositories.

### Prerequisites

1. [Node](https://nodejs.org/en) / NPM - The latest should do
1. [Docker](https://www.docker.com/) (If you want to use dev containers and/or run the whole site locally)

### Setup For Dev Containers

1. Clone the repository
1. Open the repository in VSCode and then choose "Reopen in container" when prompted.

### Setup Without Dev Containers

1. Clone the repository
1. Run `npm install` from the root.
1. Run `npm install -g turbo`
1. Run `turbo init-project` from the root

## Run a Single Game Locally

1. Open a terminal in VSCode
1. Run `turbo watch dev --filter=<ui module>` (ex. @tabletop/fresh-fish-ui)
1. Navigate to http://localhost:5173

## Run the Whole Site Locally

1. (If not using dev containers) Open a terminal in VSCode
1. (If not using dev containers) Run `docker compose up` to start redis and the firestore emulator
1. Open a terminal in VSCode
1. Run `turbo stage-ui`
1. Run `turbo watch dev`
1. If all has gone well, you can now go to http://localhost:5173 to view the site. The backend API will be running at http://localhost:3000 and the email preview site will be running at http://localhost:3001.

### First Time Running Notes

The first time the site is run locally, there are no users at all. You will be presented with the login screen and can use
the sign up link to navigate to the sign up form. After entering your information you will be prompted to entire a confirmation code that was emailed to you. If you have not signed up for an account with Resend and added your API
key to the apps/backend/.env.local file you will not receive any email. That said, if you look in the logs of the backend
process you will the confirmation code logged there and can enter it. The first user created is automatically created as a site admin.

## Architecture

See the [Project Architecture](https://github.com/justinkwaugh/tabletop/blob/main/ARCHITECTURE.md) page for more information.

## Contributing

Anyone is welcome! Nothing would make me happier than having other people dig in and grow this project. All I would ask is that you discuss your awesome ideas publicly in the discussion forum before taking on anything too big and submitting your PRs because I do want to keep some level of consistency, quality, and unified vision and I think we will achieve that through collaboration.

Furthermore this project _is_ intended to be an example of how to implement and host a website, so please feel free to take any parts for your own projects of any kind. Also feel free to take, modify and host the entire project on your own servers or cloud provider privately or publicly with whatever games you would like.

Regarding game implementations, I have no desire to limit the category or scope of any game and am happy to host the games on [Board Together](https://boardtogether.games), however there has to be certain amount of pragmatism regarding copyright. It is very true that in the United States our copyright laws do not protect game rules and mechanisms, only specific texual and graphical assets, so it is possible to implement any game desired, but conversely we also do not prevent anyone from suing or taking legal action for any reason whether or not they will ultimately win.

As such I will not require permission for a game to be implemented, however I will also not take a stand against publishers / designers if they take exception to any particular game. I _will_ have a discussion with them to see if any agreements can be reached. Your best bet is to reach out ahead of time and get permission and provide that documented permission to me (it can just be simple email from the publisher or designer) and I will add it to the project, and you **should get permission to use any published graphical assets or rulebook**.

# License

The project is licensed under [MIT](https://github.com/justinkwaugh/tabletop/blob/main/LICENSE)

Exceptions:
Any copyrightable assets (including but not limited to images, videos, text, etc.)
in this repository that are owned and copyrighted by third parties (e.g. publishers
or designers) are not subject to this license and all rights remain with the
original owners.

While permission may have been given to allow use of such copyrighted assets, that permission
may vary in scope and does not necessarily permit use outside of this project. Please see the
[Permissions](https://github.com/justinkwaugh/tabletop/blob/main/PERMISSIONS.md) file for more detail.
