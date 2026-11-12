Add a function `renamePlayer(playerId: string, newName: string): Promise<Player>` to
`src/lib/api.ts`.

It trims the name, rejects a blank name with the message "Enter a player name." and reports a
name that another player already has with "A player with that name already exists.". It returns
the renamed player.

Follow the definition of done in AGENTS.md.
