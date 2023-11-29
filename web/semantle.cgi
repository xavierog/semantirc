#!/usr/bin/env bash
echo -e "Content-Type: text/plain\r\n\r"
[ "${SEMANTLE_NEARBY}" ] && exec semantle nearby "${SEMANTLE_NEARBY}"
exec semantle top "${SEMANTLE_COUNT:-100000}" ${SEMANTLE_WORD}
