function $(q) {
    return document.querySelector(q);
}

async function check(secret) {
    const url = "/similarity/" + secret;
    const response = await fetch(url);
    try {
        return await response.json();
    } catch (e) {
        return null;
    }
}


function init() {
        $('#form').addEventListener('submit', async function(event) {
            event.preventDefault();
            const word = $('#word').value.trim().replace("!", "").replace("*", "");
            if ((await check(word)) == null) {
                $('#response').innerHTML = `Unknown secret word ${word}.`;
                return;
            }
            const len = word.length;
            const digits = 20 - len;
            const randomDigits1 = (Math.random() * 10000000000).toFixed(0);
            const randomDigits2 = (Math.random() * 10000000000).toFixed(0);
            const randomDigits = (randomDigits1 + randomDigits2);
            const urlSecret = word + randomDigits.substring(0, digits);;
            const url = `https://semantle.novalis.org/?word=${btoa(urlSecret)}`;
            $('#response').innerHTML = `<a href="${url}">${url}</a>`;

        });
}

window.addEventListener('load', async () => { init() });
