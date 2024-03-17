import { body, query, param, validationResult, CustomValidator } from 'express-validator';
import * as Games from './games.js';
import * as Users from './users.js';
import { Request, Response, NextFunction } from 'express';
import { Result, Option } from 'ts-results-es';
import { Game, User } from './types.js';

export const number_validator = body('number')
    .isInt({ min: 1 })
    .withMessage('number must be an integer larger than 0');

export const validate_rating = body('rating')
    .isIn([0, 1, 2, 3, 4, 5])
    .withMessage('rating must be an integer, one of 0, 1, 2, 3, 4, 5');

export const game_id_validator = param('id')
  .isInt({ min: 1 })
  .withMessage('id must be an integer larger than 0')
  .bail()
  .toInt()
  .custom(resource_exists<number, Game>(Games.get_game))
  .bail();

function string_validator(field: string, min: number, max: number | null = null) {
  return body(field)
    .isString()
    .trim()
    .escape()
    .notEmpty()
    .isLength(max ? { min, max} : { min })
    .withMessage(max
      ? `${field} must be between ${min} and ${max} characters`
      : `${field} must be at least ${min} characters`);
}

function int_validator(field: string, min: number, max: number | null = null) {
  return body(field)
    .isInt(max ? { min, max} : { min })
    .withMessage(max
      ? `${field} must be between ${min} and ${max}`
      : `${field} must be above ${min}`);
}

function game_validators() {
  return [
    string_validator('name', 1, 30),
    string_validator('description', 0, 2048),
    string_validator('category', 1, 10),
    string_validator('studio', 1, 30),
    int_validator('year', 1970),
  ];
}

export const existing_user_validator = [
  string_validator('username', 1, 30)
    .custom(resource_exists<string, User>(Users.find_by_username)),
  string_validator('password', 1)
];

export const new_user_validator = [
  string_validator('username', 1, 30)
    .not()
    .custom(resource_exists<string, User>(Users.find_by_username)),
  string_validator('name', 1, 30),
  string_validator('password', 1)
]

export const rating_validator = int_validator('rating', 0, 5)


export const new_game_validator = game_validators().map(validator => validator.exists());
export const patch_game_validator = game_validators().map(validator => validator.optional());

export function check_validation(req: Request, res: Response, next: NextFunction) {
    const validation = validationResult(req);

  if (!validation.isEmpty()) {
    const not_found_error = validation.array().find((error) => error.msg === 'not found');
    const server_error = validation.array().find((error) => error.msg === 'server error');
    const login_error = validation.array().find((error) => error.msg === 'username or password incorrect');

    let status = 400;

    if (server_error) {
      status = 500;
    } else if (not_found_error) {
      status = 404;
    } else if (login_error) {
      status = 401;
    }

    return res.status(status).json({ errors: validation.array() });
  }

  return next();
}


/**
 * Checks if resource exists by running a lookup function for that resource. If
 * the resource exists, the function should return the resource, it'll be added
 * to the request object under `resource`.
 * @param {function} fn Function to lookup the resource
 * @returns {Promise<undefined|Error>} Rejected error if resource does not exist
 */

function resource_exists<Identifier,Value>(fn: (value: Identifier) => Promise<Result<Option<Value>, string>>): CustomValidator {
  return (value: Identifier, { req, location, path }) => fn(value)
    .then((result) => {
      if (result.isErr())
        return Promise.reject(new Error(result.error));
      if (result.value.isNone())
        return Promise.reject(new Error('not found'));

      req.resource = result.value.value;
      return Promise.resolve();
    })
    .catch((error) => {
      if (error.message === 'not found') {
        // This we just handled
        return Promise.reject(error);
      }

      // This is something we did *not* handle, treat as 500 error
      return Promise.reject(new Error('server error'));
    });
}
