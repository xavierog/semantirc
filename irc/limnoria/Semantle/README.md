# Play Semantle on IRC


The Semantle plugin for Limnoria (ex-Supybot) lets you play Semantle on IRC.
To this end, it relies on the `semantle` CLI tool, using one directory per network+channel couple.
Both are part of the Semantirc project.

Although the `semantle` CLI tool provides 5 commands (new, set, get, guess, top), the Semantle plugin only provides 2: "guess" and "top", i.e. just enough to submit guesses and fetch the closest words from time to time.
When someone wins the game, a new game is automatically started, so there is no need for "new" and "set" commands. As to "get", it would simply ruin the entire game.

This plugin aims to remain simple so there is no score system, no hall of fame, and basically no way to prove you are the best at Semantle. This incites cooperation rather than competition.
