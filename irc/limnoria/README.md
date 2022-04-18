This directory provides a plugin for the Limnoria/Supybot IRC bot.

Here are a few directives that may make sense when configuring your own bot:
```
Config load Semantle
Config config supybot.reply.withNickPrefix False

Config config supybot.reply.whenAddressedBy.chars ''
Config load MessageParser
MessageParser add #semantle "(?i)^!?g(?:uess)?\s+(\S+)\s*$" "guess $1"
MessageParser add #semantle "(?i)^!?t(?:op)?\s+(\d+)\s*$"   "top $1"
MessageParser add #semantle "(?i)^!?t(?:op)?\s*$"           "top 5"
MessageParser add #semantle "(?i)^!?help" "echo [help guess] / [help top]"

Config config supybot.plugins.Semantle.defaultTop 5
Config config supybot.plugins.Semantle.topAfterVictory 0
Config config supybot.plugins.Semantle.textAfterVictory "Check out https://semantle.kindwolf.org/{network}/{channel}/{word} for all guesses"
Config config supybot.plugins.Semantle.delayAfterVictory 120
```
