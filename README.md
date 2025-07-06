# Collaboration App

## React Native Web + Cloudflare Workers (DO)

A simple drawing and documenting app built on top of React Native Web (Expo). I wanted to try Cloudflare Workers for the first time so the project has a [Durable Objects](https://developers.cloudflare.com/durable-objects/) backend with a boilerplate Hono API. This also encouraged me to adopt a more OOP-based approach to the server structure. The client and server are connected through WebSockets for live updates. The core idea (or "tech") present in the project is [CRDT](https://en.wikipedia.org/wiki/Conflict-free_replicated_data_type) which was implemented with the help of `@collabs/collabs`, which allows seamless collaboration between multiple peers (clients) on a shared document. In this fashion, the server acts more as a sync layer that persists and broadcasts the state that is replicated and determined on the client-side.

Right now the project lacks proper functionality to let users create and connect to arbitrary documents but it was originally meant more as fun side-project and a way to test out the `react-native-skia` library and its functionalities paired with dynamic gesture handling - something I had not done before (coming from plain React)

## TODOs

I'll come back to these to make the project more presentable.

- IOS and Android specific support
- **Tests** and possibly a CI for staging deployments
- Wrapper for creating and accessing different documents
- UI

<br/>

[Screenshot 1 - Canvas](./doc/screenshot1.png)<br/>
[Screenshot 2 - Document](./doc/screenshot2.png)
