import { Option, Some, None, Result, Err, Ok } from 'ts-results-es';
import { Argon2id } from 'oslo/password';
import { User } from './types';
import { getDatabase } from './db.js';

const argon = new Argon2id();

export async function find_by_id(id: number): Promise<Result<Option<User>, string>> {
    const db = getDatabase();
    if (!db)
        return Err('Could not get database connection');

    const q = `
SELECT id, username, name, password, admin
FROM users
WHERE id = $1
`;

    const result = await db.query(q, [id]);

    if (!result || result.rowCount !== 1)
        return Ok(None);

    return Ok(Some(result.rows[0]));
}

export async function find_by_username(username: string): Promise<Result<Option<User>, string>> {
    const db = getDatabase();
  if (!db)
    return Err('Could not get database connection');

  const q = `
SELECT id, username, name, password, admin
FROM users
WHERE username = $1
`;

  const result = await db.query(q, [username]);

  if (!result || result.rowCount !== 1)
    return Ok(None);

  return Ok(Some(result.rows[0]));
}

export async function compare_passwords(
  password: string,
  user: User
): Promise<boolean> {
  return argon.verify(user.password, password)
}

export async function create(user: Omit<Omit<Omit<User, 'id'>, 'admin'>, 'type'>): Promise<Result<User, string>> {
  const hash = await argon.hash(user.password);
  const db = getDatabase();
  if (!db)
    return Err('Could not get database connection');

  const q = `
INSERT INTO users(username, name, password)
VALUES ($1,$2,$3)
RETURNING id, username, name, password, admin;
`;

  const result = await db.query(q, [user.username, user.name, hash]);

  if (!result || result.rowCount !== 1)
    return Err('Error inserting user');

  return Ok(result.rows[0]);
}
