#!/bin/bash
PROFILE=$1
SERVER=$2
CHANNEL=$3
MESSAGE=$4

if [ -z "$MESSAGE" ]; then
  echo "Usage: ./discord_message.sh <profile> <server> <channel> <message>"
  exit 1
fi

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

node "$DIR/discord.js" "$PROFILE" switch-server "$SERVER"
node "$DIR/send_message.js" "$PROFILE" "$CHANNEL" "$MESSAGE"
