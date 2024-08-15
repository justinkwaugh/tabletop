## Project Architecture

### Backend API

Despite using SvelteKit which is generally intended to serve as both the backend and frontend of a site, I wanted to keep the API as an independant entity, such that the frontend could be implemented in other ways if desired. Perhaps a mobile client could be made in the future as an example. As such it is using Fastify running in Node.

The API itself is relatively typically designed, using JSON over HTTP. It serves administrative features such as user creation / updating / login and so forth as well as the necessary functions for the games themselves to run, and realtime communications using SSE (Server Sent Events)

Very little logic is found in the backend workspace itself, rather a set of services has been broken out into the libs/backend-services workspace. These services rely on nothing in the backend and are as follows:

**Email**

This service implements the ability to send emails to users. The default implementation provided uses [Resend](https://resend.com).

**Games**

This service handles everything related to creating and running games. It communicates with the persistence layer to store the games, and provides various functions to create / update / join / leave / run etc. the games themselves, as well as initiating notifications about the games via email and realtime transports

**Notifications**

This service manages the sending and listening to realtime notifications on various topics. It utilizes the pubsub service to do so. It may ultimately manage the sending of email notifications as well in the future, but does not currently.

**Persistence**

This service provides stores for various data objects which manage the actual persistence of the objects into datastores. There are currently stores for games, tokens and users. The provided implmentation stores uses Google's Cloud Firestore for persistence, but other datastores could easily be implemented.

**PubSub**

This service handles the actual publishing and subscribing of messages on topics. There are two implementations provided.

-   One is a local in-memory implementation which can be used if you don't want to bother with Redis, but it necessarily requires that it run in the same process as all publishers and subscribers and is synchronous in its delivery of messages
-   The other os a Redis implementation which utilizes Redis's built-in pubsub functionality to allow for messages to be sent and received across multiple instances in an asynchronous fashion.

**Secrets**

This service provides the means for the backend to access sensitive information such as API keys and secrets. There are two implementations provided.

-   One is an environment variable based one. This may or may not be relatively secure depending on your situation. Locally it will just access environment variables from your .env files which is obviously insecure, but when hosted in Cloud Run, Google Secret Manager is configured to securly inject secrets into the container securely as environment variables.
-   The other uses Google Secret Manager APIs directly, but also doesn't currently work for authentication reasons that I did not feel like tracking down. Ultimately it would be the most secure way to access any sensitive information held in GCP

**Tasks**

This service provides the ability to run enqueued tasks. It is useful to offload any asynchronous work from the synchronous communications with the user, or to schedule work in the future. Tasks are pushed to the specified endpoint on the configured host. The backend project implements the task handlers as part of its API, but there is no reason it could not be its own workspace if desired.There are two implmentations provided.

-   One is a simple implementation which directly calls the specified endpoint. This is intended for local use
-   The other uses Google Cloud Tasks which provides a full set of queueing behavior with scheduling, retries, throughput management etc.

**Tokens**

This service provides the ability to create, lookup, verify and expire plaintext tokens which reference unstructured data such as password reset request, email verifications, and game invitations. It uses the persistence layer to store the information in the datastore

**Users**

This service provides management of users of the website, such as creating, reading, external account linking, logins, password hashing and so forth. It communicates with the persistence layer to store the users.

## Frontend

The frontend is the visible website. It uses Svelte/SvelteKit as it's primary framework. It primarily provides the administrative features of the website such as user creation / login / game management. The website is a single page app (SPA) hosted statically by the backend, but served in a separate process when run locally. There is no technical reason it could not be its own full SvelteKit app with server side rending and so forth. The choice was made to make it an SPA because I did not want to dedicate instances to the frontend (the backend API itself will always be separate) and due to the nature of the site it lends itself to being an SPA.

## Games

**Common Implementation**
A game engine has been implemented which is capable of handling the common needs of a modern boardgame. At its core it is of course a state machine which uses defined state handlers and actions to update a game state and transition through the states of the game until an eventual end state is reached. It provides a core set of base types that are extended by specific game implementations as well as some useful components such as draw bags and various auction types. It also provides for some more complex interations such as simultaneous actions (e.g. a simultaneous reveal auction) with consistency checking and conflict resolution. The same engine code is used by both the frontend and backend

**Specific Games**
Game implementations are intended be very modular. They are split into two parts (simply for dependency management reasons).

-   The first part provides the model and logic of the game. This is comprised of the game state, state handlers, actions, and configuration / setup data and so forth. It has to implement and export a single type (GameDefinition) for the backend to be able to support it.
-   The second part is the UI. There is very little constraint on the UI itself, though over time I'm sure certain patterns will be factored out into components that may be shared between games, but in general a game gets the entire page space below the toolbar to express the game in any manner it desires. The only requirements are that it provide two pieces of information to the frontend, namely a GameSession class and a top level UI Svelte component. The frontend will render that component and provide an instance of the class in the component context. Beyond that component there is no specific requirement to use Svelte.

Because the games are modular, they could very easily be implemented in separate packages/repositories independent of this project.
