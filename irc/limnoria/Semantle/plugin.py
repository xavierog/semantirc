###
# Copyright (c) 2022, Xavier G.
# All rights reserved.
#
# Redistribution and use in source and binary forms, with or without
# modification, are permitted provided that the following conditions are met:
#
#   * Redistributions of source code must retain the above copyright notice,
#     this list of conditions, and the following disclaimer.
#   * Redistributions in binary form must reproduce the above copyright notice,
#     this list of conditions, and the following disclaimer in the
#     documentation and/or other materials provided with the distribution.
#   * Neither the name of the author of this software nor the name of
#     contributors to this software may be used to endorse or promote products
#     derived from this software without specific prior written consent.
#
# THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
# AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
# IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE
# ARE DISCLAIMED.  IN NO EVENT SHALL THE COPYRIGHT OWNER OR CONTRIBUTORS BE
# LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR
# CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF
# SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS
# INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN
# CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE)
# ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE
# POSSIBILITY OF SUCH DAMAGE.

###

import os
import re
import time
import subprocess
from pathlib import Path
from supybot import utils, plugins, ircutils, callbacks
from supybot.commands import *
try:
	from supybot.i18n import PluginInternationalization
	_ = PluginInternationalization('Semantle')
except ImportError:
	# Placeholder that allows to run the plugin on a bot
	# without the i18n module
	_ = lambda x: x

guess_re = r'''(?x) # extended mode
^(?P<word>[^:]+):
\s*
(?P<similarity>[0-9.-]+)
\s*
=>
\s*
(?P<percentile>cold|\d+/1000)
(?P<tail>.*)$'''

def reformat_guess(guess):
	if rem := re.match(guess_re, guess):
		word, percentile = rem.group('word'), rem.group('percentile')
		if percentile == '1000/1000':
			word = ircutils.mircColor(word, 'yellow', 'black')
		elif re.match(r'^9\d\d/1000$', percentile):
			word = ircutils.mircColor(word, 'light green', 'black')
		word = ircutils.bold(word)
		guess = word + ': ' + rem.group('similarity') + ' => ' + percentile + rem.group('tail')
	return guess

class Semantle(callbacks.Plugin):
	"""Play Semantle on IRC"""
	threaded = True
	single_word_argument = [('matches', re.compile(r'^(?P<word>[a-zA-Z-]+)$'), 'letters and hyphens only')]
	def __init__(self, irc):
		self.__parent = super(Semantle, self)
		self.__parent.__init__(irc)
		self.semantle_game_path = os.environ.get('SEMANTLE_GAME_PATH', 'semantle/bin/game')
		self.hint_tracking = {}

	def current_hint_tracking(self, irc, msg):
		return self.hint_tracking.setdefault(irc.network, {}).setdefault(msg.channel, {'guesses_since_last_hint': 0})

	def update_hint_tracking(self, irc, msg, action='get'):
		tracking = self.current_hint_tracking(irc, msg)
		if action == 'reset':
			tracking['guesses_since_last_hint'] = 0
		elif action == 'increment':
			tracking['guesses_since_last_hint'] += 1
		return tracking['guesses_since_last_hint']

	def path_channel(self, channel):
		return channel.replace('#', '')

	def home_for_channel(self, network, channel):
		"""Return the channel-specific path to use as $HOME to provide per-channel games."""
		return Path(os.environ['HOME']) / 'network' / network / 'channel' / self.path_channel(channel)

	def make_environment(self, network, channel):
		"""Return a copy of the current environment variables, with $HOME
		overridden so as to provide per-channel games."""
		environ = os.environ.copy()
		environ['HOME'] = self.home_for_channel(network, channel)
		return environ

	def run(self, irc, channel, autoreply, *args):
		"""Run the "game" command, for the given channel, with the given command-line arguments."""
		environ = self.make_environment(irc.network, channel)
		process = subprocess.run([self.semantle_game_path, *args], env=environ, stdout=subprocess.PIPE)
		lines = process.stdout.decode('utf-8').splitlines()
		if autoreply:
			self.reply(irc, lines)
		return process, lines

	def reply(self, irc, lines):
		for line in lines:
			irc.reply(line or ' ', sendImmediately=True)
			time.sleep(0.5)

	def is_victory(self, lines):
		for line in lines:
			if 'YOU WON!' in line:
				return True
		return False

	def guess(self, irc, msg, args, word):
		"""<word>
		Submit <word> as a guess for the current game in the current channel."""
		if msg.channel is None:
			irc.reply('I cannot answer that outside a channel.')
			return
		data = msg.nick if msg.nick is not None else ''
		guess_word = word.group('word').lower()
		self.update_hint_tracking(irc, msg, 'increment')
		process, lines = self.run(irc, msg.channel, False, 'guess', guess_word, data)
		lines = list(map(reformat_guess, lines))
		self.reply(irc, lines)
		# After victory:
		if self.is_victory(lines):
			# Optionally display top guesses:
			top_after_victory = self.registryValue('topAfterVictory')
			if top_after_victory:
				irc.reply(f'Top {top_after_victory}:', sendImmediately=True)
				self.run(irc, msg.channel, True, 'top', f'{top_after_victory}')
			# Optionally display a URL:
			text = self.registryValue('textAfterVictory')
			if text:
				text = text.replace('{network}', irc.network)
				text = text.replace('{channel}', self.path_channel(msg.channel))
				text = text.replace('{word}', guess_word)
				irc.reply(text)
			# Wait a little then start a new game:
			time.sleep(self.registryValue('delayAfterVictory'))
			self.update_hint_tracking(irc, msg, 'reset')
			self.run(irc, msg.channel, True, 'new')

	def top(self, irc, msg, args, n):
		"""[<n>]
		List top <n> guesses for the current game in the current channel."""
		if msg.channel is None:
			irc.reply('I cannot answer that outside a channel.')
			return
		if n is None:
			n = self.registryValue('defaultTop')
		process, lines = self.run(irc, msg.channel, False, 'top', f'{n}')
		if not lines:
			irc.reply('No guesses yet.')
		else:
			lines = map(reformat_guess, lines)
			self.reply(irc, lines)

	def hint(self, irc, msg, args):
		"""takes no argument
		Give a hint about the current game."""
		if msg.channel is None:
			irc.reply('I cannot answer that outside a channel.')
			return
		needed_guesses = 25 - self.update_hint_tracking(irc, msg)
		if needed_guesses > 0:
			guesses = 'guesses' if needed_guesses > 1 else 'guess'
			irc.reply(f'You need {needed_guesses} more {guesses} to earn a hint.')
			return
		self.update_hint_tracking(irc, msg, 'reset')
		process, lines = self.run(irc, msg.channel, False, 'hint')
		lines = map(reformat_guess, lines)
		self.reply(irc, lines)

	guess = wrap(guess, single_word_argument)
	top = wrap(top, [optional('positiveInt')])
	hint = wrap(hint)

Class = Semantle
