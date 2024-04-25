# Hyper-RSS
# ⚠️  WARNING 🚧 API unstable ⚒️  and still in development 👷

Peer-to-peer RSS. This repo provides:

## Usage

Start the `aggregator` backend with:
```shell
cd aggregator && yarn server
```

Start the web frontend, which needs `aggregator`:
```shell
cd web && yarn dev
```

## Goals

* Standardized format for interoperability
* Be able to easily create a hrss feed from a regular rss/atom feed.
* Pulling updates into the hrss feed from a regular rss/atom feed should be easy.
* Writer defaults should provide a consistent level of protection against
  identifying who created the stream. Just that all URL's which we download
  data from should removed. One way to do this, the writer can keep a secret,
  along with it's URL. This secret can be used as a salt to hash the URL's
  with. Then these hashed URL's can be used to identify data. Providing total
  anonymity is beyond our scope. However we sholud allow for writers to be
  configured manually to mutate/randomize/tweak incoming data to prevent
  fingerprinting.

## Internal Goals

To satisfy my own interests I'd like to do a few things in this project.

* Explore interoperability between node and rust.
    * rust -> FFI -> nodejs
    * rust -> wasm -> nodejs
    * try building datrs code to be used from node
        * contribute to datrs to help the project better integrate with the nodejs libs


### Configuring

I want to be able to load a writer without having to provid the URL evertime.
If I want to create a new Writer, for a new URL. The URL must be provided.

If I want to create an instance of an existing writer. I should NOT provide the URL.
Because then it would be possible to provide a URL that conflicts with the data of the store.
However I do not want to keep the URL within the hypercore because this data would be shared.
This is bad because the URL may be private/unique/fingerprintable.

So... The two ways of creating a Write. New and existing.
Existing is created by loading the config info from a file.
This file has the URL and storage name. New can just be provide a URL.
Then it should create this config file.

Reader *can* piggy ack off this config file to ease local testing, for this reason we add the discovery key to it.

### Different builds

We should be able to split this into two builds, Writer-reader and reader. Where reader is smaller because it does not need the stuff to pull parse write the hrss

## Entry Points

* rss downloading
* serve local rss (from data downloaded by via rss downloading)
