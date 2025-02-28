/*
    Copyright (c) 2022, David Turner <novalis@novalis.org>

     This program is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation, version 3.

    This program is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License for more details.

    You should have received a copy of the GNU General Public License along with this program. If not, see <https://www.gnu.org/licenses/>.
*/
'use strict';

const now = Date.now();
const today = Math.floor(now / 86400000);
const initialDay = 19021;
function getPuzzleNumber(day) {
    return (day - initialDay) % secretWords.length;
}
function getSecretWord(day) {
    return secretWords[getPuzzleNumber(day)];
}

let gameOver = false;
let firstGuess = true;
let guesses = [];
let latestGuess = undefined;
let guessed = new Set();
let guessCount = 0;
let model = null;
const puzzleNumber = getPuzzleNumber(today);
let handleStats = puzzleNumber >= 24;
const yesterdayPuzzleNumber = getPuzzleNumber(today - 1);
let puzzleKey;
let storage;
let caps = 0;
let warnedCaps = 0;
let chrono_forward = 1;
let hints_used = 0;
let darkModeMql = window.matchMedia('(prefers-color-scheme: dark)');
let darkMode = false;

function $(q) {
    return document.querySelector(q);
}

function mag(a) {
    return Math.sqrt(a.reduce(function(sum, val) {
        return sum + val * val;
    }, 0));
}

function dot(f1, f2) {
    return f1.reduce(function(sum, a, idx) {
        return sum + a*f2[idx];
    }, 0);
}

function getCosSim(f1, f2) {
    return dot(f1,f2)/(mag(f1)*mag(f2));
}


function plus(v1, v2) {
    const out = [];
    for (let i = 0; i < v1.length; i++) {
            out.push(v1[i] + v2[i]);
    }
    return out;
}

function minus(v1, v2) {
    const out = [];
    for (let i = 0; i < v1.length; i++) {
        out.push(v1[i] - v2[i]);
    }
    return out;
}


function scale (v, s) {
    const out = [];
    for (let i = 0; i < v.length; i++) {
        out.push(v[i] * s);
    }
    return out;
}


function project_along(v1, v2, t) {
    const v = minus(v2, v1);
    const num = dot(minus(t, v1), v);
    const denom = dot(v,v);
    return num/denom;
}

function share() {
    // We use the stored guesses here, because those are not updated again
    // once you win -- we don't want to include post-win guesses here.
    const text = solveStory(JSON.parse(storage.getItem("guesses")),
                            puzzleNumber,
                            parseInt(storage.getItem("winState")),
                            hints_used);
    const copied = ClipboardJS.copy(text);

    if (copied) {
        alert("Copied to clipboard");
    }
    else {
        alert("Failed to copy to clipboard");
    }
}

const words_selected = [];
const cache = {};
let secret = "";
let secretVec = null;
let similarityStory = null;
let customMode = false;

function select(word, secretVec) {
    /*
    let model;
    if (!(word in cache)) {
        // this can happen on a reload, since we do not store
        // the vectors in localstorage
        model = cache[word];
    } else {
        model = getModel(word);
        cache[word] = model;
    }
    words_selected.push([word, model.vec]);
    if (words_selected.length > 2) {
        words_selected.pop();
    }
    const proj = project_along(words_selected[0][1], words_selected[1][1],
                               target);
    console.log(proj);
*/
}

function guessRow(similarity, oldGuess, percentile, guessNumber, guess) {
    let percentileText = "(cold)";
    let progress = "";
    let cls = "";
    if (similarity >= similarityStory.rest * 100) {
        percentileText = '<span class="weirdWord">????<span class="tooltiptext">Unusual word found!  This word is not in the list of &quot;normal&quot; words that we use for the top-1000 list, but it is still similar! (Is it maybe capitalized?)</span></span>';
    }
    if (percentile) {
        if (percentile == 1000) {
            percentileText = "FOUND!";
        } else {
            cls = "close";
            percentileText = `<span class="percentile">${percentile}/1000</span>&nbsp;`;
            progress = ` <span class="progress-container">
<span class="progress-bar" style="width:${percentile/10}%">&nbsp;</span>
</span>`;
        }
    }
    let color;
    if (oldGuess === guess) {
        color = '#c0c';
    } else if (darkMode) {
        color = '#fafafa';
    } else {
        color = '#000';
    }
    const similarityLevel = similarity * 2.55;
    let similarityColor;
    if (darkMode) {
        similarityColor = `255,${255-similarityLevel},${255-similarityLevel}`;
    } else {
        similarityColor = `${similarityLevel},0,0`;
    }
    return `<tr><td>${guessNumber}</td><td style="color:${color}" onclick="select('${oldGuess}', secretVec);">${oldGuess}</td><td style="color: rgb(${similarityColor})">${similarity.toFixed(2)}</td><td class="${cls}">${percentileText}${progress}
</td></tr>`;

}

function updateLocalTime() {
    const now = new Date();
    now.setUTCHours(24, 0, 0, 0);

    const localtime = `or ${now.getHours()}:${now.getMinutes().toString().padStart(2, "0")} your time`;
    $('#localtime').innerHTML = localtime;
    $('#localtime2').innerHTML = localtime;
}

function plural(count, word) {
    if (count === 1) {
        return word;
    }

    if (word.match(/(sh|ch|th|s)$/)) {
        return word + "es";
    }
    return word + "s";
}


function solveStory(guesses, puzzleNumber, won, hints_used) {
    const guess_count = guesses.length;
    if (guess_count === 0) {
        return `I gave up on Semantle ${puzzleNumber} without even guessing once. https://semantle.novalis.org/`;
    }

    let guesses_less_hints = guess_count - hints_used;

    if (guess_count === 1) {
        if (won) {
            return `I got Semantle ${puzzleNumber} on my first guess!  https://semantle.novalis.org/`;
        } else {
            return `I gave up on Semantle ${puzzleNumber} after my first guess!  https://semantle.novalis.org/`;
        }
    }

    let describe = function(similarity, percentile) {
        let out = `had a similarity of ${similarity.toFixed(2)}`;
        if (percentile) {
            out += ` (${percentile}/1000)`;
        }
        return out;
    };

    const guesses_chrono = guesses.slice();
    guesses_chrono.sort(function(a, b){return a[3]-b[3];});

    let [similarity, old_guess, percentile, guess_number] = guesses_chrono[0];
    let first_guess = `My first guess ${describe(similarity, percentile)}.`;
    let first_guess_in_top = !!percentile;

    let first_hit = '';
    if (!first_guess_in_top) {
        for (let entry of guesses_chrono) {
            [similarity, old_guess, percentile, guess_number] = entry;
            if (percentile) {
                first_hit = `  My first word in the top 1000 was at guess #${guess_number}.  `;
                break;
            }
        }
    }

    let last_guess_msg;
    if (won) {
        const penultimate_guess = guesses_chrono[guesses_chrono.length - 2];
        [similarity, old_guess, percentile, guess_number] = penultimate_guess;
        last_guess_msg = `My penultimate guess ${describe(similarity, percentile)}.`;
    } else {
        const last_guess = guesses_chrono[guesses_chrono.length - 1];
        [similarity, old_guess, percentile, guess_number] = last_guess;
        last_guess_msg = `My last guess ${describe(similarity, percentile)}.`;
    }

    let hints = "";
    if (hints_used > 0)  {
        hints = ` with ${hints_used} ${plural(hints_used, "hint")}`;
    }

    const solved = won ? "solved" : "gave up on";
    return `I ${solved} Semantle #${puzzleNumber} in ${guesses_less_hints} guesses${hints}. ${first_guess}${first_hit}${last_guess_msg} https://semantle.novalis.org/`;
}


function getQueryParameter(name) {
    const url = window.location.href
    const regex = new RegExp('[?&]' + name + '(=([^&#]*)|&|#|$)');
    const results = regex.exec(url);
    if (!results) return null;
    if (!results[2]) return '';
    return decodeURIComponent(results[2]);
}

let Semantle = (function() {
    async function getSimilarityStory(secret) {
        const url = "/similarity/" + secret;
        const response = await fetch(url);
        try {
            return await response.json();
        } catch (e) {
            return null;
        }
    }

    async function getModel(word) {
        if (cache.hasOwnProperty(word)) {
            return cache[word];
        }
        const url = "/model2/" + secret + "/" + word.replace(/\ /gi, "_");
        const response = await fetch(url);
        try {
            const result = await response.json();
            if (result) {
                cache[guess] = result;
            }
            return result;
        } catch (e) {
            return null;
        }
    }

    async function getNearby(word) {
        const url = "/nearby/" + word ;
        const response = await fetch(url);
        try {
            return await response.json();
        } catch (e) {
            return null;
        }
    }

async function hint(guesses) {
    function hintNumber(guesses) {
        if (guesses.length === 0) {
            return 1;
        }
        const nearest_top1k = guesses[0][2];
        if (nearest_top1k === undefined) {
            return 1;
        }

        if (nearest_top1k === 999) {
            for (let i = 1; i < guesses.length; i++) {
                if (guesses[i][2] !== 999 - i) {
                    return 999 - i;
                }
            }
            // user has guessed all of the top 1k except the actual word.
            return -1;
        }

        return Math.floor((nearest_top1k + 1000) / 2);
    }

    const n = hintNumber(guesses);
    if (n < 0) {
        alert("No more hints are available.");
    }
    const url = "/nth_nearby/" + secret + "/" + n;
    const response = await fetch(url);
    try {
        const hint_word = await response.json();
        hints_used += 1;
        doGuess(hint_word, true);
    } catch (e) {
        console.log(e);
        alert("Fetching hint failed");
    }
}

async function doGuess(guess, is_hint) {
    if (secretVec === null) {
        secretVec = (await getModel(secret)).vec;
    }

    const guessData = await getModel(guess);
    if (!guessData) {
        $('#error').textContent = `I don't know the word ${guess}.`;
        return false;
    }

    let percentile = guessData.percentile;

    const guessVec = guessData.vec;

    let similarity = getCosSim(guessVec, secretVec) * 100.0;
    if (!guessed.has(guess)) {
        if (!gameOver) {
            guessCount += 1;
        }
        guessed.add(guess);

        const newEntry = [similarity, guess, percentile, guessCount];
        guesses.push(newEntry);

        if (handleStats) {
            const stats = getStats();
            if (!gameOver && !is_hint) {
                stats['totalGuesses'] += 1;
            }
            storage.setItem('stats', JSON.stringify(stats));
        }
    }
    guesses.sort(function(a, b){return b[0]-a[0]});

    if (!gameOver) {
        saveGame(-1, -1);
    }

    chrono_forward = 1;

    latestGuess = guess;
    updateGuesses();

    firstGuess = false;
    if (guess.toLowerCase() === secret && !gameOver) {
        endGame(true, true);
    }
}

    async function init() {
        secret = getSecretWord(today).toLowerCase();
        storage = window.localStorage;
        puzzleKey = puzzleNumber;

        const urlSecret = getQueryParameter('word');
        if (urlSecret) {
            try {
                const word = atob(urlSecret).replace(/[0-9]+/, '');
                similarityStory = await getSimilarityStory(word);
                if (similarityStory == null) {
                    alert(`It looks like you clicked a custom puzzle link, but it was somehow broken.  I'll show you today's puzzle instead.`);
                } else {
                    secret = word;
                    customMode = true;
                    handleStats = false;
                    // Use sessionStorage to avoid interfering with
                    // the global game state
                    storage = window.sessionStorage
                    puzzleKey = urlSecret;
                }
            } catch (e) {
                // user error -- just show regular semantle
                console.log("ERR: " + e);
                similarityStory = await getSimilarityStory(secret);
            }
        } else {
            similarityStory = await getSimilarityStory(secret);
        }

        const yesterday = secretWords[yesterdayPuzzleNumber].toLowerCase();

        $('#yesterday').innerHTML = `Yesterday's word was <b>"${yesterday}"</b>.`;
        let pastWeek = [];
        for (let i = 2; i < 9; i ++) {
            pastWeek.push(`"${getSecretWord(today - i)}"`);
        }
        $('#yesterday2').innerHTML = `"${yesterday}". The words before that were: ${pastWeek.join(", ")}`;

        // explicitly use localStorage for this
        $('#lower').checked = window.localStorage.getItem("lower") == "true";

        $('#lower').onchange = (e) => {
            window.localStorage.setItem("lower", "" + $('#lower').checked);
        };

        try {
            const yesterdayNearby = await getNearby(yesterday);
            const secretBase64 = btoa(unescape(encodeURIComponent(yesterday)));
            $('#nearbyYesterday').innerHTML = `${yesterdayNearby.join(", ")}, in descending order of closeness. <a href="nearby_1k/${secretBase64}">More?</a>`;
        } catch (e) {
            $('#nearbyYesterday').innerHTML = `Coming soon!`;
        }
        updateLocalTime();

        try {
            if (customMode) {
                $('#similarity-story').innerHTML = `
You're viewing a <b>custom puzzle</b>. Click <a href="/">here for today's official puzzle</a>. The nearest word has a similarity of
<b>${(similarityStory.top * 100).toFixed(2)}</b>, the tenth-nearest has a similarity of
${(similarityStory.top10 * 100).toFixed(2)} and the one thousandth nearest word has a
similarity of ${(similarityStory.rest * 100).toFixed(2)}.
`;

            } else {
                $('#similarity-story').innerHTML = `
Today is puzzle number <b>${puzzleNumber}</b>. The nearest word has a similarity of
<b>${(similarityStory.top * 100).toFixed(2)}</b>, the tenth-nearest has a similarity of
${(similarityStory.top10 * 100).toFixed(2)} and the one thousandth nearest word has a
similarity of ${(similarityStory.rest * 100).toFixed(2)}.
`;
            }
        } catch {
            // we can live without this in the event that something is broken
        }

        const storagePuzzleNumber = storage.getItem("puzzleNumber");
        if (storagePuzzleNumber != puzzleKey) {
            storage.removeItem("guesses");
            storage.removeItem("winState");
            storage.setItem("puzzleNumber", puzzleKey);
        }

        document.querySelectorAll(".dialog-close").forEach((el) => {
            el.innerHTML = ""
            el.appendChild($("#x-icon").content.cloneNode(true));
        });

        if (!window.localStorage.getItem("readRules")) {
            openRules();
        }

        $("#rules-button").addEventListener('click', openRules);
        $("#settings-button").addEventListener('click', openSettings);

        document.querySelectorAll(".dialog-underlay, .dialog-close, #capitalized-link").forEach((el) => {
            el.addEventListener('click', () => {
                document.body.classList.remove('dialog-open', 'rules-open', 'settings-open');
            });
        });

        document.querySelectorAll(".dialog").forEach((el) => {
            el.addEventListener("click", (event) => {
                // prevents click from propagating to the underlay, which closes the rules
                event.stopPropagation();
            });
        });

        // accordion functionality taken from
        // https://www.w3schools.com/howto/howto_js_accordion.asp
        document.querySelectorAll(".accordion").forEach((el) => {
          el.addEventListener("click", function() {
            this.classList.toggle("active");

            const panel = this.nextElementSibling;
            if (panel.style.display === "block") {
              panel.style.display = "none";
            } else {
              panel.style.display = "block";
            }
          });
        });

        $("#dark-mode").addEventListener('click', function(event) {
            window.localStorage.setItem("prefersDarkColorScheme", event.target.checked);
            darkModeMql.onchange = null;
            darkMode = event.target.checked;
            toggleDarkMode(darkMode);
            updateGuesses();
        });

        toggleDarkMode(darkMode);

        if (window.localStorage.getItem("prefersDarkColorScheme") === null) {
            $("#dark-mode").checked = false;
            $("#dark-mode").indeterminate = true;
        }

        $('#give-up-btn').addEventListener('click', function(event) {
            if (!gameOver) {
                if (confirm("Are you sure you want to give up?")) {
                    endGame(false, true);
                }
            }
        });

        $('#hint-btn').addEventListener('click', async function(event) {
            if (!gameOver) {
                if (confirm("Are you sure you want a hint?")) {
                    await hint(guesses);
                }
            }
        });

        $('#form').addEventListener('submit', async function(event) {
            event.preventDefault();
            $('#guess').focus();
            $('#error').textContent = "";
            let guess = $('#guess').value.trim().replace("!", "").replace("*", "");
            if (!guess) {
                return false;
            }
            if ($("#lower").checked) {
                guess = guess.toLowerCase();
            }

            if (typeof unbritish !== 'undefined' && unbritish.hasOwnProperty(guess)) {
                guess = unbritish[guess];
            }

            if (guess[0].toLowerCase() != guess[0]) {
                caps += 1;
            }
            if (caps >= 2 && (caps / guesses.length) > 0.4 && !warnedCaps) {
                warnedCaps = true;
                $("#lower").checked = confirm("You're entering a lot of words with initial capital letters.  This is probably not what you want to do, and it's probably caused by your phone keyboard ignoring the autocapitalize setting.  \"Nice\" is a city. \"nice\" is an adjective.  Do you want me to downcase your guesses for you?");
                window.localStorage.setItem("lower", "true");
            }

            $('#guess').value = "";

            await doGuess(guess, false);

            return false;
        });

        const winState = storage.getItem("winState");
        if (winState != null) {
            hints_used = JSON.parse(storage.getItem("hints_used") || "0");
            guesses = JSON.parse(storage.getItem("guesses"));
            for (let guess of guesses) {
                guessed.add(guess[1]);
            }
            guessCount = guessed.size;
            latestGuess = "";
            updateGuesses();
            if (winState != -1) {
                endGame(winState > 0, false);
            }
        }
    }

    function openRules() {
        document.body.classList.add('dialog-open', 'rules-open');
        window.localStorage.setItem("readRules", true);
        $("#rules-close").focus();
    }

    function openSettings() {
        document.body.classList.add('dialog-open', 'settings-open');
        $("#settings-close").focus();
    }

    function updateGuesses() {
        let inner = `<tr><th id="chronoOrder">#</th><th id="alphaOrder">Guess</th><th id="similarityOrder">Similarity</th><th>Getting close?</th></tr>`;
        /* This is dumb: first we find the most-recent word, and put
           it at the top.  Then we do the rest. */
        for (let entry of guesses) {
            let [similarity, oldGuess, percentile, guessNumber] = entry;
            if (oldGuess == latestGuess) {
                inner += guessRow(similarity, oldGuess, percentile, guessNumber, latestGuess);
            }
        }
        inner += "<tr><td colspan=4><hr></td></tr>";
        for (let entry of guesses) {
            let [similarity, oldGuess, percentile, guessNumber] = entry;
            if (oldGuess != latestGuess) {
                inner += guessRow(similarity, oldGuess, percentile, guessNumber);
            }
        }
        $('#guesses').innerHTML = inner;
        $('#chronoOrder').addEventListener('click', event => {
            guesses.sort(function(a, b){return chrono_forward * (a[3]-b[3])});
            chrono_forward *= -1;
            updateGuesses();
        });
        $('#alphaOrder').addEventListener('click', event => {
            guesses.sort(function(a, b){return a[1].localeCompare(b[1])});
            chrono_forward = 1;
            updateGuesses();
        });
        $('#similarityOrder').addEventListener('click', event => {
            guesses.sort(function(a, b){return b[0]-a[0]});
            chrono_forward = 1;
            updateGuesses();
        });
    }

    function toggleDarkMode(on) {
        document.body.classList[on ? 'add' : 'remove']('dark');
        const darkModeCheckbox = $("#dark-mode");
        // this runs before the DOM is ready, so we need to check
        if (darkModeCheckbox) {
            darkModeCheckbox.checked = on;
        }
    }

    function checkMedia() {
        const storagePrefersDarkColorScheme = window.localStorage.getItem("prefersDarkColorScheme");
        if (storagePrefersDarkColorScheme === 'true' || storagePrefersDarkColorScheme === 'false') {
            darkMode = storagePrefersDarkColorScheme === 'true';
        } else {
            darkMode = darkModeMql.matches;
            darkModeMql.onchange = (e) => {
                darkMode = e.matches;
                toggleDarkMode(darkMode)
                updateGuesses();
            }
        }
        toggleDarkMode(darkMode);
    }

    function saveGame(guessCount, winState) {
        // If we are in a tab still open from yesterday, we're done here.
        // Don't save anything because we may overwrite today's game!
        let savedPuzzleNumber = storage.getItem("puzzleNumber");
        if (savedPuzzleNumber != puzzleKey) { return }

        storage.setItem("winState", winState);
        storage.setItem("guesses", JSON.stringify(guesses));
        storage.setItem("hints_used", JSON.stringify(hints_used));
    }

    function getStats() {
        const oldStats = storage.getItem("stats");
        if (oldStats == null) {
            const stats = {
                'firstPlay' : puzzleNumber,
                'lastEnd' : puzzleNumber - 1,
                'lastPlay' : puzzleNumber,
                'winStreak' : 0,
                'playStreak' : 0,
                'totalGuesses' : 0,
                'wins' : 0,
                'giveups' : 0,
                'abandons' : 0,
                'totalPlays' : 0,
                'hints' : 0,
            };
            storage.setItem("stats", JSON.stringify(stats));
            return stats;
        } else {
            const stats = JSON.parse(oldStats);
            stats['hints'] = stats['hints'] || 0;
            if (stats['lastPlay'] != puzzleNumber) {
                const onStreak = (stats['lastPlay'] == puzzleNumber - 1);
                if (onStreak) {
                    stats['playStreak'] += 1;
                }
                stats['totalPlays'] += 1;
                if (stats['lastEnd'] != stats['lastPlay']) {
                    stats['abandons'] += 1;
                }
                stats['lastPlay'] = puzzleNumber;
            }
            return stats;
        }
    }

    function endGame(won, countStats) {
        let stats;
        if (handleStats) {
            stats = getStats();
            if (countStats) {
                const onStreak = (stats['lastEnd'] == puzzleNumber - 1);

                stats['lastEnd'] = puzzleNumber;
                if (won) {
                    if (onStreak) {
                        stats['winStreak'] += 1;
                    } else {
                    stats['winStreak'] = 1;
                    }
                    stats['wins'] += 1;
                } else {
                    stats['winStreak'] = 0;
                    stats['giveups'] += 1;
                }
                stats['hints'] += hints_used;
                storage.setItem("stats", JSON.stringify(stats));
            }
        }

        $('#give-up-btn').style = "display:none;";
        $('#response').classList.add("gaveup");
        gameOver = true;
        const secretBase64 = btoa(unescape(encodeURIComponent(secret)));
        let response;
        let share = '';
        if (!customMode) {
            share = '<a href="javascript:share();">Share</a> and play again tomorrow. ';
        }
        if (won) {
            response = `<p><b>You found it in ${guesses.length}!  The secret word is ${secret}</b>.  Feel free to keep entering words if you are curious about the similarity to other words. ${share} You can see the nearest words <a href="nearby_1k/${secretBase64}">here</a>.</p>`
        } else {
            response = `<p><b>You gave up!  The secret word is: ${secret}</b>.  Feel free to keep entering words if you are curious about the similarity to other words.  ${share}  You can see the nearest words <a href="nearby_1k/${secretBase64}">here</a>.</p>`;
        }

        if (handleStats) {
            const totalGames = stats['wins'] + stats['giveups'] + stats['abandons'];
            response += `<br/>
Stats (since we started recording, on day 23): <br/>
<table>
<tr><th>First game:</th><td>${stats['firstPlay']}</td></tr>
<tr><th>Total days played:</th><td>${totalGames}</td></tr>
<tr><th>Wins:</th><td>${stats['wins']}</td></tr>
<tr><th>Win streak:</th><td>${stats['winStreak']}</td></tr>
<tr><th>Give-ups:</th><td>${stats['giveups']}</td></tr>
<tr><th>Did not finish:</th><td>${stats['abandons']}</td></tr>
<tr><th>Total guesses across all games:</th><td>${stats['totalGuesses']}</td></tr>
<tr><th>Average guesses across all games:</th><td>${(stats['totalGuesses'] / totalGames).toFixed(2)}</td></tr>
<tr><th>Total hints used:</th><td>${stats['hints']}</td></tr>
</table>
`;
        }
        $('#response').innerHTML = response;

        if (countStats) {
            saveGame(guesses.length, won ? 1 : 0);
        }
    }

    return {
        init: init,
        checkMedia: checkMedia,
    };
})();

// do this when the file loads instead of waiting for DOM to be ready to avoid
// a flash of unstyled content
Semantle.checkMedia();

window.addEventListener('load', async () => { Semantle.init() });
