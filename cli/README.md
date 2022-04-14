# Play Semantle on the command line

The Semantirc project provides the `semantle` cli tool, which enables playing Semantle locally, through the command line.

# Dependencies
## Semantle data
`semantle` needs the same data as the original Semantle project; refer to data/README.md for instructions.

## Python modules
Beyond standard Python modules, `semantle` depends on the `xdg` module (e.g. `apt install python3-xdg` or `pip install xdg`).

# Usage
Start a new game and try guessing the word:
```console
$ semantle new
new game started.
$ semantle guess dog
dog: 58.68 => 987/1000
$ semantle guess cat
cat: 62.61 => 994/1000
$ semantle guess rabbit
rabbit: 100.0 => 1000/1000
YOU WON! It took only 3 attempts -- congrats, you have been very fast!
$ semantle top
rabbit: 100.0 => 1000/1000
cat: 62.61 => 994/1000
dog: 58.68 => 987/1000
```

There is no "give up" feature, but the answer is never very far:
```console
$ semantle get
rabbit
```

You can also set the secret word yourself:
```console
$ semantle set supercalifragilisticexpialidocious
```

You can store additional data, such as your name, along with your attempts:
```console
$ semantle guess hello alice
hello: 30.43 => cold (alice)
$ semantle guess goodbye bob
goodbye: 22.23 => cold (bob)
$ semantle top
hello: 30.43 => cold (alice)
poppin: 23.59 => cold (bob)
mary: 22.3 => cold (alice)
goodbye: 22.23 => cold (bob)
super: 16.21 => cold (alice)
fragile: 2.13 => cold (bob)
```

`semantle top` also works with previously played words: `semantle top 25 rabbit`

# Environment variables
The `semantle` CLI tool supports the following environment variables:
* HOME and XDG_* environment variables
* SEMANTLE_DEBUG=y -- in case you stumble upon Oops: something went wrong :(` and want to diagnose what went wrong
* SEMANTLE_DATA_PATH -- path to Semantle data files: word2vec.db, secret_words.json, british_spellings.json
* SEMANTLE_WORD2VEC_OPTIONS -- extra SQLite URI options used to open word2vec.db -- likely useless

# Under the hood
Games are stored as simple directories whereas attempts are stored as (invalid) symlinks. All of this typically happens in `~/.local/share/semantle`.
It is possible to host separate instances by playing with the HOME and/or XDG environment variables (and this is exactly what the IRC part of this project does).
