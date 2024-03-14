import { Result, Err, Option, Some, None, Ok } from 'ts-results-es';
import { getDatabase } from './db.js';
import { Game } from './types';

const MAX_GAMES = 100;

/**
 * Get games from the database.
 * @param {number} [limit=MAX_GAMES] Number of games to get.
 */
export async function get_games(limit: number = MAX_GAMES): Promise<Result<Array<Game>, string>> {
  const db = getDatabase();

  if (!db)
    return Err('Could not get database connection');

  const q = `
SELECT id, name, category, description, studio, year
FROM games
LIMIT $1
`;

  const used_limit = Math.min(limit > 0 ? limit : MAX_GAMES, MAX_GAMES);

  const results = await db.query(q, [used_limit.toString()]);

  if (!results || results.rowCount === 0)
    return Ok([]);

  return Ok(results.rows);
}

/**
 * Get a game from the database.
 */
export async function get_game(id: number): Promise<Result<Option<Game>, string>> {
  const db = getDatabase();
  if (!db)
    return Err('Could not get database connection');

  const q = `
SELECT id, name, category, description, studio, year
FROM games
WHERE id = $1
`;

  const results = await db.query(q, [id]);
  if (!results || results.rowCount === 0)
    return Ok(None);

  return Ok(Some(results.rows[0]));
}

/**
 * Insert a game into the database.
 */
export async function insert_game(game: Omit<Game, 'id'>): Promise<Result<Game, string>> {
  const db = getDatabase();
  if (!db)
    return Err('Could not get database connection');

  const q = `
INSERT INTO games (name, category, description, studio, year)
VALUES ($1, $2, $3, $4, $5)
RETURNING id, name, category, description, studio, year;
`;

  const result = await db.query(q, [
    game.name,
    game.category,
    game.description,
    game.studio,
    game.year,
  ]);

  if (!result || result.rowCount !== 1) {
    return Err(`unable to insert game, ${{ result, game }}`);
  }

  return Ok(result.rows[0]);
}

export async function update_game(game: Game): Promise<Result<Game, string>> {
  const db = getDatabase();
  if (!db)
    return Err('Could not get database connection');

  const result = await db.query(`
UPDATE games
SET
  name = $1,
  category = $2,
   description = $3,
   studio = $4,
   year = $5
WHERE id = $6
RETURNING id, name, category, description, studio, year;
`, [
    game.name,
    game.category,
    game.description,
    game.studio,
    game.year,
    game.id
]);

  if (!result || result.rowCount !== 1) {
    return Err(`unable to update game, ${{ result, game }}`);
  }

  return result.rows[0];
}

/**
 * Delete a game from the database.
 */
export async function delete_game(id: number): Promise<Result<true, string>> {
  const db = getDatabase();
  if (!db)
    return Err('Could not get database connection');

  const result = await db.query('DELETE FROM games WHERE id = $1', [id]);
  if (!result || result.rowCount !== 1)
    return Err(`unable to delete game, ${{ result, id }}`);

  return Ok(true);
}
