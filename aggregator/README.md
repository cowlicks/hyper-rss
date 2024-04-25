A demo of aggregating hrss feeds.
Like an RSS reader or podcatcher, but peer to peer.

# Usage

Run the backend server with:
```shell
yarn run server
```
The data is kept in `test/data/agg_init`.
Remove the data in this directory to clear the data.
To add data to the directory do

```shell
yarn pull-test-data
```


## Modified JSON-RPC

We use a modified form of JSON-RPC.
We omit the `jsonrpc: "2.0"` part of the request object.
