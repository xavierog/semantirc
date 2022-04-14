When playing Semantle on the command line, the "top" command is convenient enough.
However, when playing Semantle on IRC, the "top" command is cumbersome: it can only display a short number of words before one starts noticing the slow pace at which the bot works to prevent flood protections from kicking in.
That is why it makes sense to expose the top command over HTTP(S), so players can follow the game in their browser or console.
Browser users will likely want to set up an "auto-refresh" addon whereas console users will simply rely on "watch curl -s".

Anyway, this directory provides a trivial CGI wrapper around the `semantle top` command, along with an example of nginx+fcgiwrap configuration.
