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
|--/config-eslint - Lint config
|--/email - React Email project for email editing / previewing
|--/frontend-components - Shared frontend components
```

The frontend is run as a separate Vite process during development but for deployment is compiled into a static SPA and served by the backend. Game implementations are modular and could even be imported from external repositories.

## How to install and run locally

### Prerequisites

1. [Node](https://nodejs.org/en) / NPM - The latest should do
1. Firebase Emulator Tools - specifically and only the Firestore emulator. Follow these [installation instructions](https://firebase.google.com/docs/emulator-suite/install_and_configure)
1. [Docker](https://www.docker.com/)
1. Turbo - `npm install -g turbo`

### Setup

1. Clone the repository
1. Run `npm install --force` from the root. Currently the project is using a preview version of Svelte 5 and as such there a few dependency conflicts which need to be forced until certain libraries are updated.
1. In the root of the backend workspace `/apps/backend` add a file named `.env.local` and populate it as shown below. Note that in order to support Google and Discord login you will need to provide appropriate ids/secrets as indicated. More details will be provided later in this document. Likewise in order to have the project send emails you will need a Resend account and it's API key:

```
FIRESTORE_EMULATOR_HOST="127.0.0.1:8080"
GCLOUD_PROJECT="demo-tabletop"
FRONTEND_HOST="http://localhost:5173"
TASKS_HOST="http://localhost:3000"

SESSION_SECRET=
SESSION_SALT=

REDIS_HOST="localhost"
REDIS_PORT="6379"
REDIS_USERNAME=
REDIS_PASSWORD=

GOOGLE_CLIENT_ID=

DISCORD_CLIENT_ID=
DISCORD_PUBLIC_KEY=
DISCORD_SECRET=
DISCORD_BOT_TOKEN=

ABLY_API_KEY=
RESEND_API_KEY=

VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
```

4. In the root of the frontend workspace `/apps/frontend` add a file named `.env.development.local` and populate it as follows:

```
PUBLIC_API_HOST="http://localhost:3000"
PUBLIC_SSE_HOST="http://localhost:3000"

PUBLIC_GOOGLE_CLIENT_ID=
PUBLIC_VAPID_KEY=
```

### Running Locally

1. In a terminal window navigate to apps/backend and run `npm run firestore` to start the firestore emulator.
1. In another terminal window at the root of the project run
   `turbo redis` to start a local redis instance in a container
1. In yet another terminal window, run `turbo watch dev` to build and run the actual project locally.
1. If all has gone well, you can now go to http://localhost:5173 to view the site. The backend API will be running at http://localhost:3000 and the email preview site will be running at http://localhost:3001.

## Architecture

See the [Project Architecture](https://github.com/justinkwaugh/tabletop/blob/main/ARCHITECTURE.md) page for more information.

## Contributing

Anyone is welcome! Nothing would make me happier than having other people dig in and grow this project. All I would ask is that you discuss your awesome ideas publicly in the discussion forum before taking on anything too big and submitting your PRs because I do want to keep some level of consistency, quality, and unified vision and I think we will achieve that through collaboration.

Furthermore this project _is_ intended to be an example of how to implement and host a website, so please feel free to take any parts for your own projects of any kind. Also feel free to take, modify and host the entire project on your own servers or cloud provider privately or publicly with whatever games you would like.

Regarding game implementations, I have no desire to limit the category or scope of any game and am happy to host the games on [Board Together](https://boardtogether.games), however there has to be certain amount of pragmatism regarding copyright. It is very true that in the United States our copyright laws do not protect game rules and mechanisms, only specific texual and graphical assets, so it is possible to implement any game desired, but conversely we also do not prevent anyone from suing or taking legal action for any reason whether or not they will ultimately win.

As such I will not require permission for a game to be implemented, however I will also not take a stand against publishers / designers if they take exception to any particular game. I _will_ have a discussion with them to see if any agreements can be reached. Your best bet is to reach out ahead of time and get permission and provide that documented permission to me (it can just be simple email from the publisher or designer) and I will add it to the project, and you **must get permission to use any published graphical assets or rulebook**.

# License

[MIT](https://github.com/justinkwaugh/tabletop/blob/main/LICENSE)
