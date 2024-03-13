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
    `;
    return this.query(q);
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