# Hyper-RSS - ⚠️  WARNING 🚧 under construction 👷

# Update

The initial goals for Hyper-RSS were completed. It provides basic tooling for creating, seeding, aggregating, and viewing (with audio and video!) HRSS feeds.
However, this work highlighted a significant limitation of the Node.js Hypercore implementation: **the tooling can only operate within Node.js or similar JavaScript runtime**.
This limitation severely restricts Hyper-RSS's potential impact.

For any peer-to-peer protocol to be effective, it needs a diverse and large network of peers.
Being confined to Node.js means we're limiting potential peers to users of Node.js applications only.
We can't ask existing RSS readers, torrent clients, or websites like The Pirate Bay to integrate Hyper-RSS because most aren't built with Node.js.

To address this, I've been working on the [datrs project](https://github.com/datrs), a Rust implementation of Hypercore stack.
When completed, this implementation can be used via FFI (Foreign Function Interface) in any environment that supports C libraries - which is virtually everywhere.
You can follow and support this work [here](https://github.com/sponsors/cowlicks).

## Description

Peer-to-peer RSS built on [`Hypercore`](https://docs.pears.com/building-blocks/hypercore). This repo provides:

## Goals

- [x] Create a hrss peer for reading writing, available as a library (`peer/`)
- [x] Create a simple feed reader/aggregator app (`aggregator/`)
- [x] Be able to easily create a hrss feed from a regular rss/atom feed.
- [x] Updating an hrss feed from a regular rss/atom feed should be easy.
- [x] Standardized format of hrss
- [ ] Standardize  formats for podcasts and TV shows on top of stand hrss format

## Usage

Start the `aggregator` backend with:
```shell
cd aggregator && yarn server
```

Start the web frontend, which needs `aggregator`:
```shell
cd web && yarn dev
```
