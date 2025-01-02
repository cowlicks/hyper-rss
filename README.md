# Hyper-RSS
# ⚠️  WARNING 🚧 API unstable ⚒️  and still in development 👷

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
