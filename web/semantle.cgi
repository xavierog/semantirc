#!/usr/bin/env bash
echo -e "Content-Type: text/plain\r\n\r"
exec semantle top "${SEMANTLE_COUNT:-100000}" ${SEMANTLE_WORD}
