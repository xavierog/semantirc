#!/usr/bin/env bash
set -e

mkdir -p working_directory/data
cd working_directory

# Need a virtualenv for both gdown and semantle
[ -d .venv ] || python3 -m venv .venv
source .venv/bin/activate

echo 'Step 0: get Google vectors'
google_vectors='GoogleNews-vectors-negative300.bin'
# Need gdown to fetch this file from Google Drive:
command -v gdown || pip install gdown
if [ ! -f "${google_vectors}" ]; then
	if [ ! -f "${google_vectors}.gz" ]; then
		gdown 'https://drive.google.com/uc?id=0B7XkCwpI5KDYNlNUTTlSS21pQmM'
	fi
	gzip -d "${google_vectors}.gz"
fi

[ -d semantle ] || git clone https://gitlab.com/novalis_dt/semantle.git
cd semantle

echo 'Step 1: install Python requirements'
# gensim will likely require some compilation and thus gcc/g++ packages + libpython3-dev
pip install -r requirements.txt

echo 'Step 2: make Google vectors available to semantle scripts'
ln -sfn "../${google_vectors}" "${google_vectors}"

i=3
for script in dump-vecs dump-hints store-hints british; do
	echo "Step ${i}: run ${script}.py"
	[ -f "${script}.done" ] || python "${script}.py" && touch "${script}.done"
	((i++))
done

echo 'Step 7: assemble files in the data directory'
cd ..
ln -f semantle/word2vec.db data/
sed 's/^unbritish=//;    s/\;$//'             semantle/static/assets/js/british_spellings.js > data/british_spellings.json
sed 's/^secretWords =//; s/^"beat",$/"beat"/' semantle/static/assets/js/secretWords.js       > data/secret_words.json

echo 'All done in working_directory/data:'
find data -ls
