# Goals

* Writer defaults should provide a consistent level of protection against identifying who created the stream. Just that all URL's which we download data from should removed. One way to do this, the writer can keep a secret, along with it's URL. This secret can be used as a salt to hash the URL's with. Then these hashed URL's can be used to identify data. Providing total anonymity is beyond our scope. However we sholud allow for writers to be configured manually to mutate/randomize/tweak incoming data to prevent fingerprinting.

## Internal Goals

To satisfy my own interests I'd like to do a few things in this project.

* Explore interoperability between node and rust. Write somethings in rust and expose them with rust's FFI. Then call them from node. I'd also like to explore using datrs code via FFI.
