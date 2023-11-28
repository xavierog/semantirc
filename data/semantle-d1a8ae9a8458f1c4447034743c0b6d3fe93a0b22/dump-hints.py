# gensim monkeypatch
import collections.abc

collections.Mapping = collections.abc.Mapping

from functools import partial
import pickle

import gensim.models.keyedvectors as word2vec

import json

from numpy import dot
from numpy.linalg import norm

import re
import tqdm.contrib.concurrent

from collections import namedtuple
from hashlib import sha1
from pathlib import Path

import code, traceback, signal

# check against all words + phrases in model?
ALL_WORDS = False

vectors = str(Path(__file__).parent / "GoogleNews-vectors-negative300.bin")
model = word2vec.KeyedVectors.load_word2vec_format(vectors, binary=True)


Word = namedtuple("Word", ["name", "vec", "norm"])


def make_words():
    allowable_words = set()
    with open("words_alpha.txt") as walpha:
        for line in walpha.readlines():
            allowable_words.add(line.strip())

    print("loaded alpha...")

    # The banned words are stored obfuscated because I do not want a giant
    # list of banned words to show up in my repository.
    banned_hashes = set()
    with open("banned.txt") as f:
        for line in f:
            banned_hashes.add(line.strip())

    simple_word = re.compile("^[a-z]*$")
    words = {}
    for word in model.key_to_index:
        if ALL_WORDS or (simple_word.match(word) and word in allowable_words):
            h = sha1()
            h.update(("banned" + word).encode("ascii"))
            hash = h.hexdigest()
            if not hash in banned_hashes:
                vec = model[word]
                words[word] = Word(name=word, vec=vec, norm=norm(vec))

    return words


words = make_words()


def debug(sig, frame):
    """Interrupt running process, and provide a python prompt for
    interactive debugging."""
    d = {"_frame": frame}  # Allow access to frame object.
    d.update(frame.f_globals)  # Unless shadowed by global
    d.update(frame.f_locals)

    i = code.InteractiveConsole(d)
    message = "Signal received : entering python shell.\nTraceback:\n"
    message += "".join(traceback.format_stack(frame))
    i.interact(message)


def find_hints(secret):
    """Return hints for the 1,000 closest words"""
    target_word = words[secret]
    target_vec = target_word.vec
    target_vec_norm = target_word.norm

    #        syns = synonyms.get(secret) or []
    similarities = []

    for word in words.values():
        #            if word.name in syns:
        #                continue
        #            if secret in (synonyms.get(word.name) or []):
        #                # yow, asymmetrical!
        #                continue
        #            if word.name in secret or secret in word.name:
        #                continue
        # why not model.wv.similarity(wordA, wordB)?
        similarity = dot(word.vec, target_vec) / (word.norm * target_vec_norm)
        similarities.append((float(similarity), word.name))

    similarities.sort()

    # Closest items are at the end of the list, pick the last 1000
    nearest = similarities[-1000:]
    return secret, nearest


if __name__ == "__main__":
    signal.signal(signal.SIGUSR1, debug)  # Register handler

    # synonyms = {}

    # with open("moby/words.txt") as moby:
    #     for line in moby.readlines():
    #         line = line.strip()
    #         words = line.split(",")
    #         word = words[0]
    #         synonyms[word] = set(words)

    print("loaded moby...")

    hints = {}

    secrets = []  # to have length for progress bar

    with open("static/assets/js/secretWords.js") as f:
        for line in f.readlines():
            line = line.strip()
            if not '"' in line:
                continue
            secrets.append(line.strip('",'))

    CONCURRENCY = True
    if CONCURRENCY:
        # may need to limit concurrency for memory reasons
        # XXX bug: wraps all results into a list, e.g. won't write any until the very end
        mapper = tqdm.contrib.concurrent.process_map(
            partial(find_hints),
            secrets,
            max_workers=12,
            chunksize=1,
            total=len(secrets),
        )
    else:
        mapper = tqdm.tqdm(
            (find_hints(secret) for secret in secrets), total=len(secrets)
        )

    with open("hints.json", "w+") as hints_file:
        for secret, nearest in mapper:
            hints_file.write(json.dumps({"word": secret, "neighbors": nearest}))
            hints_file.write("\n")
            hints_file.flush()
            hints[secret] = nearest

    with open(b"nearest.pickle", "wb") as f:
        pickle.dump(hints, f)
