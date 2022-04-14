It is impossible to play Semantle without data.
This document briefly explains how to generate the 3 data files required to play Semantle.

# data directory
All files described in this document should end up in the same "data" directory.
Depending on your deployment constraints, you can pick:
* any directory set through the `SEMANTLE_DATA_PATH` environment variable
* any of the standard XDG directories:
  * ~/.local/share/semantle/data
  * /usr/local/share/semantle/data
  * /usr/share/semantle/data
* `data`, relative to the current working directory

# word2vec.db
This is THE most important file. Specifically, it is a SQLite database that contains everything needed to compute semantic distances between two known words.
The recipe to generate this file lives at https://gitlab.com/novalis_dt/semantle and involves downloading a database provided by Google and running three Python scripts.

# british_spellings.json
This file can simply be found here: https://gitlab.com/novalis_dt/semantle/-/blob/master/british_spellings.json

Alternatively, it is possible to run `british.py`, thus generating a slightly smaller variant in `static/assets/js/british_spellings.js`.
This JavaScript file can easily be turned into a regular JSON file:
```bash
sed 's/^unbritish=//; s/\;$//' static/assets/js/british_spellings.js > /path/to/data/british_spellings.json
```

# secret_words.json
Again, a simple JS-to-JSON transformation should do:
```bash
sed 's/^secretWords =//; s/^"beat",$/"beat"/' static/assets/js/secretWords.js > /path/to/data/secret_words.json
```

# Why is this so complicated?
word2vec.db is not exactly a small file (2.3 GiB) and it is purely data, so it does not make sense to ship it along with this project. And since the other files are so trivial to get once word2vec.db was generated, it does not make sense to ship those either.
Of course, none of this is very convenient. In the future, this project may provide a script that takes care of everything described above.
