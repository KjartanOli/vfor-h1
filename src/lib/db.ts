import pg from 'pg';
import slugify from 'slugify';
import { ILogger, logger as loggerSingleton } from './logger.js';
import { Game } from './types.js'; 
import { environment } from './environment.js';


const MAX_GAMES = 100;

/**
 * Database class.
 */
export class Database {
  private connectionString: string;
  private logger: ILogger;
  private pool: pg.Pool | null = null;

  /**
   * Create a new database connection.
   */
  constructor(connectionString: string, logger: ILogger) {
    this.connectionString = connectionString;
    this.logger = logger;
  }

  open() {
    this.pool = new pg.Pool({ connectionString: this.connectionString });

    this.pool.on('error', (err) => {
      this.logger.error('error in database pool', err);
      this.close();
    });
  }

  /**
   * Close the database connection.
   */
  async close(): Promise<boolean> {
    if (!this.pool) {
      this.logger.error('unable to close database connection that is not open');
      return false;
    }

    try {
      await this.pool.end();
      return true;
    } catch (e) {
      this.logger.error('error closing database pool', { error: e });
      return false;
    } finally {
      this.pool = null;
    }
  }

  /**
   * Connect to the database via the pool.
   */
  async connect(): Promise<pg.PoolClient | null> {
    if (!this.pool) {
      this.logger.error('Reynt að nota gagnagrunn sem er ekki opinn');
      return null;
    }

    try {
      const client = await this.pool.connect();
      return client;
    } catch (e) {
      this.logger.error('error connecting to db', { error: e });
      return null;
    }
  }

  /**
   * Run a query on the database.
   * @param query SQL query.
   * @param values Parameters for the query.
   * @returns Result of the query.
   */
  async query(
    query: string,
    values: Array<string | number> = [],
  ): Promise<pg.QueryResult | null> {
    const client = await this.connect();

    if (!client) {
      return null;
    }

    try {
      const result = await client.query(query, values);
      return result;
    } catch (e) {
      this.logger.error('Error running query', e);
      return null;
    } finally {
      client.release();
    }
  }


  /**
   * Create the database schema.
   */
  async createSchema(): Promise<pg.QueryResult | null> {
    const q = `
      DROP TABLE IF EXISTS games;
      CREATE TABLE IF NOT EXISTS games (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        category TEXT NOT NULL,
        description TEXT NOT NULL,
        studio TEXT NOT NULL,
        year INTEGER NOT NULL
      );
      DROP TABLE IF EXISTS ratings;
      CREATE TABLE IF NOT EXISTS ratings (
        id SERIAL PRIMARY KEY,
        game_id INTEGER NOT NULL,
        rating INTEGER NOT NULL,
        FOREIGN KEY (game_id) REFERENCES games (id)
      );
    `;
    return this.query(q);
  }


  /**
   * Get games from the database.
   * @param {number} [limit=MAX_GAMES] Number of games to get.
   */
  async getGames(limit = MAX_GAMES): Promise<Game[] | null> {
    const q = `
      SELECT * FROM games ORDER BY id DESC LIMIT $1;
    `;

    // Ensure we don't get too many games and that we get at least one
    const usedLimit = Math.min(limit > 0 ? limit : MAX_GAMES, MAX_GAMES);

    const result = await this.query(q, [usedLimit.toString()]);

    const games: Array<Game> = [];
    if (result && (result.rows?.length ?? 0) > 0) {
      for (const row of result.rows) {
        const game: Game = {
          id: row.id,
          name: row.name,
          category: row.category,
          description: row.description,
          studio: row.studio,
          year: row.year,
        };
        games.push(game);
      }

      return games;
    }

    return null;
  }

  /**
   * Get a game from the database.
   */
  async getGame(id: string): Promise<Game | null> {
    const q = `
      SELECT * FROM games WHERE id = $1
    `;

    const result = await this.query(q, [id]);

    if (result && result.rows.length === 1) {
      const row = result.rows[0];
      const game: Game = {
        id: row.id,
        name: row.name,
        category: row.category,
        description: row.description,
        studio: row.studio,
        year: row.year,
      };
      return game;
    }

    return null;
  }




  /**
   * Insert a game into the database.
   */
  async insertGame(game: Omit<Game, 'id'>): Promise<Game | null> {
    const q = `
      INSERT INTO games (name, category, description, studio, year) VALUES ($1, $2, $3, $4, $5) RETURNING *;
    `;

    const result = await this.query(q, [
      game.name,
      game.category,
      game.description,
      game.studio,
      game.year,
    ]);

    if (!result || result.rowCount !== 1) {
      this.logger.warn('unable to insert game', { result, game });
      return null;
    }
    return this.getGame(result.rows[0].id);
  }



  /**
   * Delete a game from the database.
   */
  async deleteGame(id: string): Promise<boolean> {
    const result = await this.query('DELETE FROM games WHERE id = $1', [id]);

    if (!result || result.rowCount !== 1) {
      this.logger.warn('unable to delete game', { result, id });
      return false;
    }
    return true;
  }

  async updateGame(game: Game) {

    const result = await this.query('UPDATE games SET name = $1, category = $2, description = $3, studio = $4, year = $5 WHERE id = $6', [
      game.name,
      game.category,
      game.description,
      game.studio,
      game.year,
      game.id
    ]); 
    if (!result || result.rowCount !== 1) {
      this.logger.warn('unable to update game', { result, game });
      return false;
    }
    return true;
  }

  async get_ratings(game_id: number) {
    const result = await this.query('SELECT * FROM ratings WHERE game_id = $1 ORDER BY id DESC', [game_id]);
    if (!result) {
      return null;
    }
    return result.rows;
  }

  async insert_rating(game_id: number, rating: number) {
    const result = await this.query('INSERT INTO ratings (game_id, rating) VALUES ($1, $2)', [
      game_id,
      rating
    ]); 
    if (!result || result.rowCount !== 1) {
      this.logger.warn('unable to insert rating', { result, rating });
      return false;
    }
    return true;
  }

}


let db: Database | null = null;

/**
 * Return a singleton database instance.
 */
export function getDatabase() {
  if (db) {
    return db;
  }

  const env = environment(process.env, loggerSingleton);

  if (!env) {
    return null;
  }
  db = new Database(env.connectionString, loggerSingleton);
  db.open();

  return db;
}