## Overview

This document describes the overall design of how games are organized and implemented.

## General Concepts

### Separation of UI and Game Logic

- The game's state machine and game component (board, deck, pieces etc.) logic is a standard Typescript project defined in its own project workspace, named by the name of the game. This will be referred to as the "game logic" project
- The game logic project is compiled to a module used in both the backend and frontend and may not include any frontend related dependencies such as DOM manipulation.
- The game's UI is a Svelte project defined in its own project workspace, named by the same name as the game logic project with the string `-ui` appended. This will be referred to as the "game UI" project
- Both the game logic project and the game UI project should live in self-named sub-directories of the `games` directory

Naming Example:

- Game name: _Go Fish_
- Game logic module name: `@tabletop/go-fish`
- Game logic workspace directory: `games/go-fish`
- Game UI module name: `@tabletop/go-fish-ui`
- Game UI workspace directory: `games/go-fish-ui`

### Types

Model types are defined using the **Typebox** library. This allows for easy definition of both a JSON schema and Typescript type which enables data validation at both the API boundary and internal logic.

- When possible use `Type.Evaluate`/`Type.Intersect` to extend/refine "base" type definitions with additional properties
- Avoid using typebox types that are not truly JSON schema compatible.
- Specifying a default value for any given property is acceptable

### Hydratables

This project uses an interpretion of the concept of hydration in that there are plain JSON types defined for most model objects and then "hydrated" classes which implement the same types but provide additional class based functionality, and which can be instantiated given a plain ("non-hydrated") version of the object.

The `Hydratable` class is the base class of all hydrated classes and importantly it takes both the non-hydrated object and a Typebox `Validator` instance as constructor parameters, so when defining types that are going to have hydrated classes, a validator should also be compiled using Typebox's `Compile`.

Population of a `Hydratable` subclass's properties is done in the base class constructor, so all properties must be defined using the `declare` keyword, because they are not known by Typescript to be populated in the constructor.

Note that the base `Hydratable` class does not know about nested hydrated properties, and so in the constructor of `Hydrated` classes it is necessary to hydrate (instantiate the appropriate `Hydratable` subclass) any property that is itself hydrated.

### Seeded Pseudo Random Number Generator

Every game has an integer seed which is used to seed a pseudo random number generator. When needing a random number or id, the seeded pseudo random number generator should be used to provide a deterministic random value. There is a `getPrng()` method on `HydratedGameState` which will return a psuedo ranom number generator for the given game state (and which will update it when invoked)

### Common library

There is a library called `@tabletop/common` which contains the base definitions and classes for games and the game engine, as well as several pre-defined components and utilities including a graph library (graph in the computer science sense, not graphical).

### Example Workspaces

An example of a game logic project can be found in the `games/sample` workspace

### Tests

Testing in this project is done using vitest. It is reasonable to provide some unit tests for actions, components, and state handlers. They should be defined alongside the source files using the same file prefix but with `.spec.ts` as the suffix. Make sure tests are written based on the game rules not based on the action implementation logic.

## Game Logic Project

### Project Scaffolding Checklist

- Include `.eslintrc.cjs`, `tsconfig.json`, `tsconfig.types.json`, `vitest.config.ts`, and `package.json` aligned with existing game packages

### Game Definition

The game logic module can be imported and used by the UI and backend like a plugin, in that there is an object that defines the external interface of the module. That object should implement the `GameDefinition` interface and must be exported as `Definition`. It should be defined in a file called `gameDefinition.ts` in the `src/definition` directory of the game logic project.

### Game State Machine and Components

#### State Machine

The state machine of a game is comprised of:

- Machine States
- Actions
- State handlers
- Game state model
- Player state model

##### Machine States

The machine states are defined as simple string names for the possible states of the state machine, best defined as an enum with literal string values called `MachineState` in a file named `states.ts` in the `src/definition` directory of the game logic project

Example:

```
export enum MachineState {
    StartOfTurn = 'StartOfTurn',
    PlaceBid = 'PlaceBid',
    EndOfGame = 'EndOfGame'
}
```

##### Actions

Actions are what cause transitions from machine state to machine state. They can be initiated by a player or by other actions or state handlers. Actions are refined extensions of the `GameAction` type. What this means is that the typebox definition is intersected with the `GameAction` schema but may adjust some of the properties in the defined schema/type.

A good practice is to define all of the string names of the actions in an enum named `ActionType` in a file named `actions.ts` in the `src/definition` directory of the game logic project.

Each action has two parts, a type definition created using Typebox that defines the shape/type of the data, and a "Hydrated" class that extends `HydratableAction` and which implements the specific action type as well.

Action types and classes should be placed in a file named after the action in the `src/actions` directory of the game logic project.

Example action type definition:

```
export type Pass = Static<typeof Pass>
export const Pass = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['type','playerId']), // Omit properties to be refined
        Type.Object({
            type: Type.Literal(ActionType.Pass), // Redefine as a literal value
            playerId: Type.String(), // Redefine as a required property
            reason: Type.String() // An additional property on this type of action
        })
    ])
)
```

Notes:

- It is a best practice to define a metadata type which is added as an optional property to an action type. This metadata type can store the outputs or relevant state data for a given action so that the UI or logging can provide information or a detailed description about the action in the absence of the game state at that time. Try to imagine how you would describe the action taken as a sentence, and you will be able to identify the information that may be useful to store in the metadata object. The property _must_ be optional because it will not be populated prior to action processing / validation.

- All of the additional properties defined on the specific action type except for the aforementioned metadata object should be considered immutable. The metadata object is the place for any data that should be added during the action processing.

- Sometimes actions may be done simultaneously by players. An example is a blind bid auction where everyone bids simultaneously and then the results are revealed. This can be supported by populated the `simultaneousGroupId` property on the action.

- Actions that reveal hidden info, such as drawing from a bag or a deck, or revealing hidden bids should be marked as such by setting the `revealsInfo` property to true (or redefining it as always true when defining the type if that is the case)

- A type guard function named `is<Action>` should be created for every action.

##### Hydrated Action Classes

These classes extend `HydratableAction` and therefore implement `HydratedAction` and the specific action type of the given action. They should be defined in the same file as the action's type definition.

it is a good practice for the hydratable action class to provide a static `can<Action>` method which accepts both a `HydratedGameState` subclass and a player id for the UI and state handlers to use to determine the ability of a player to perform the action at all. There is no need to determine all possible places or ways the action can be taken, just presence of a single ability to take the action is enough for the method to return true.

An example class can be found in `games/sample/actions/addAmount.ts`

##### State Handlers

One state handler exists for each state defined. The state handler must implement `MachineStateHandler`.

State handlers perform the following functions:

- Define the set of allowed actions which can be applied to a state
- Define the valid actions that a player make take for a state. This is commonly used by the UI to hide/show elements representing the actions available to the player
- Handle the entering of a state
- React to an action having been applied and provide the next state as a result.

Notes:

- State handlers should be defined in a file in the `src/stateHandlers` named appropriately based on the state name directory of the game logic project.
- Gerunds are preferred for naming if it is to represent a state that normally would be a verb, i.e. name a state handler "fishing" not "fish"
- Try to avoid overly generic state names like 'playing'. Use more specific names such as 'takingActions'.

Example Naming:

- State name `fishing`
- State handler file name `fishing.ts`
- State handler class name `FishingStateHandler`

Additionally there should be a file name `stateHandlers.ts` in the `src/definition` folder of the game logic project which defines a record mapping all of the states to an instance of their handler.

Example:

```
export const SampleStateHandlers: Record<MachineState, MachineStateHandler<HydratedAction>> = {
    [MachineState.StartOfTurn]: new StartOfTurnStateHandler(),
    [MachineState.EndOfGame]: new EndOfGameStateHandler()
}
```

Generally it is good practice to have a `StartOfTurn` state and an `EndOfGame` state, in addition to any other necessary states.

It is useful to use the static `can<Action>` methods of the `HydratedAction` classes to determine the valid actions for a given player id.

##### Game State

Every game has a game state type which intersects the `GameState` type, providing refinement of the `PlayerState` type and specific `MachineState` type as well as various properties used to track the state of the game.

Example:

```
export type SampleGameState = Static<typeof SampleGameState>
export const SampleGameState = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameState, ['players', 'machineState']),
        Type.Object({
            players: Type.Array(SamplePlayerState), // Redefine with the specific player state type
            machineState: Type.Enum(MachineState), // Redefine with the specific machine states
            total: Type.Number(), // Some game-specific property
            maxTotal: Type.Number() // Another game-specific property
        })
    ])
)
```

- Additionally a hydrated version of the game state must be defined which extends `HydratableGameState` and therefore implements `HydratedGameState` as well as the associate specific game state type for the game.

- This type is used to track state information for the state machine that is specific to the game, but not to specific players.

- The game state should be defined in a file named `gameState.ts` in the `src/model` directory of the game logic project

- Make sure the types of the hydrated game state properties match that of the base hydrated class, specifically as it relates to hydrated types.

##### Player State

Every game has a defined player state type which which intersects the `PlayerState` type, adding various properties used to track the state of the players in the game.

Example:

```
export type SamplePlayerState = Static<typeof SamplePlayerState>
export const SamplePlayerState = Type.Evaluate(
    Type.Intersect([
        PlayerState,
        Type.Object({
            score: Type.Number(), // Player's score
            amount: Type.Number() // Some player-specific property
        })
    ])
)
```

- Additionally a hydrated version of the player state must be defined which extends `Hydratable` and implements the specific player state type for the game.

- This type is used to track state information for the state machine that is specific to the individual players.

- The player state should be defined in a file named `playerState.ts` in the `src/model` directory of the game logic project

#### Components

Sometimes certain game concepts or components require more complicated logic, or can be easily encapsulated and re-used. Examples are generic concepts like draw bags, decks, auctions, game boards etc. You should implement these as such, with separately defined state to represent them and hydrated classes to add the applicable logic. They can then be added to the game/player state as the component type itself (and remember to use the hydrated type on the hydrated game/player state).

- Pre-existing components have been implemented in the `@tabletop/common` library to handle many common needs in games. Some examples are a variety of auction types, draw bags, round and phase management and so on.

- Components should be defined in files in the `src/components` directory of the game logic project

- Game board components will often require use of a graph provided by the graph functionality in `@tabletop/common`

- **Make sure you look to see if there is a component in `@tabletop/common` that already serves your needs before implementing it yourself!**

Reuse checklist for gameplay mechanisms (auction, draft, bag, turn order, etc.):

- Search `libs/common/src/game/components` for an existing component (example: `rg -n "auction" libs/common/src/game/components`).
- Prefer reuse or extension over bespoke implementations.
- If you diverge, briefly explain why in the final response and cite the component you considered.

## Implementation Checklist

- Read the provided rules
- Scaffold the new project
- Ask about any missing information or rule ambiguities. Regardless of the answer, record them in a file called RULES_QUESTIONS.md at the root of the new project
- Implement the game rules following the design and conventions outlined above
- Build the module to verify it compiles
- Run your generated test cases
