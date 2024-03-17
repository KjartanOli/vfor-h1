import { Result, Err, Option, Some, None, Ok } from 'ts-results-es';
import { getDatabase } from './db.js';
import { Game, Rating, ResourceType } from './types.js';

const page_size = 10;

/**
 * Get games from the database.
 * @param {number} [limit=MAX_GAMES] Number of games to get.
 */
export async function get_games(offset: number = 0, limit: number | null = page_size): Promise<Result<Array<Game>, string>> {
  const db = getDatabase();

  if (!db)
    return Err('Could not get database connection');

  const q = `
SELECT id, name, category, description, studio, year
FROM games
`;

  const used_limit = Math.min((limit && limit > 0) ? limit : page_size, page_size);

  const results = await db.paged_query(q, offset, used_limit);

  if (!results)
    return Err('Database error');

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

  const game: Game = { ...results.rows[0], type: ResourceType.GAME };
  return Ok(Some(game));
}

/**
 * Insert a game into the database.
 */
export async function insert_game(game: Omit<Omit<Game, 'id'>, 'type'>): Promise<Result<Game, string>> {
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

  return Ok({ ...result.rows[0], type: ResourceType.GAME });
}

export async function update_game(game: Omit<Game, 'type'>): Promise<Result<Game, string>> {
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

  return Ok({ ...result.rows[0], type: ResourceType.GAME });
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

export async function get_ratings(game_id: number, offset: number = 0, limit: number | null = page_size): Promise<Result<Array<Rating>, string>> {
    const db = getDatabase();
    if (!db)
        return Err('Could not get database connection');

    const used_limit = Math.min((limit && limit > 0) ? limit : page_size, page_size);
    const result = await db.paged_query(`
SELECT user_id, game_id, rating
FROM ratings
WHERE game_id = $1
`, offset, used_limit, [game_id]);
    if (!result) {
        return Err('Error retrieving ratings');
    }

    return Ok(result.rows);
}

export async function insert_rating(user_id: number, game_id: number, rating: number): Promise<Result<Rating, string>> {
    const db = getDatabase();
    if (!db)
        return Err('Could not get database connection');

    const result = await db.query(`
INSERT INTO ratings (user_id, game_id, rating)
VALUES ($1, $2, $3)
RETURNING user_id, game_id, rating
`, [
  user_id,
  game_id,
  rating
]);

    if (!result || result.rowCount !== 1) {
        return Err(`unable to insert rating ${{ result, rating }}`);
    }
    return Ok(result.rows[0]);
}

export async function get_rating(user_id: number, game_id: number): Promise<Result<Option<Rating>, string>> {
    const db = getDatabase();
    if (!db)
        return Err('Could not get database connection');

  const q = `
SELECT user_id, game_id, rating
FROM ratings
WHERE user_id = $1 AND game_id = $2
`;

  const result = await db.query(q, [user_id, game_id]);
  if (!result)
    return Err('Database error');

  if (result.rowCount === 0)
    return Ok(None);

  return Ok(Some(result.rows[0]));
}
