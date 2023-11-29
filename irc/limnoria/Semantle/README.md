# Play Semantle on IRC


The Semantle plugin for Limnoria (ex-Supybot) lets you play Semantle on IRC.
To this end, it relies on the `semantle` CLI tool, using one directory per network+channel couple.
Both are part of the Semantirc project.

Although the `semantle` CLI tool provides 7 commands (new, set, get, guess, top, nearby, hint), the Semantle plugin only provides 3: "guess", "top" and "hint", i.e. just enough to submit guesses, fetch the closest words from time to time and beg for help.
When someone wins the game, a new game is automatically started, so there is no need for "new" and "set" commands. As to "get", it would simply ruin the entire game.

This plugin aims to remain simple so there is no score system, no hall of fame, and basically no way to prove you are the best at Semantle. This incites cooperation rather than competition.
