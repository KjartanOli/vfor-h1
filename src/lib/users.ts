import { Option, Some, None } from 'ts-results-es';
import { User } from './types';

export async function find_by_id(id: number): Promise<Option<User>> {
  return Some({
    id: 1,
    username: 'admin',
    name: 'Admin',
    password: 'not a real password',
    admin: true
  })
}
export async function find_by_username(username: string): Promise<Option<User>> {
  return Some({
    id: 1,
    username: 'admin',
    name: 'Admin',
    password: 'not a real password',
    admin: true,
  });
}

export async function compare_passwords(
  password: string,
  hash: string
): Promise<boolean> {
  // TODO: Implement actual password hashing
  return password == hash;
}

