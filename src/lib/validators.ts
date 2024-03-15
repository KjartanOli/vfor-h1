import { body, query, param, validationResult } from 'express-validator';
import * as Games from './games.js';
import { Request, Response, NextFunction } from 'express';

export const number_validator = body('number')
    .isInt({ min: 1 })
    .withMessage('number must be an integer larger than 0');

export const validate_rating = body('rating')
    .isIn([0, 1, 2, 3, 4, 5])
    .withMessage('rating must be an integer, one of 0, 1, 2, 3, 4, 5');

export const game_id_validator = param('game')
  .isInt({ min: 1 })
  .withMessage('id must be an integer larger than 0')
  .bail()
  .toInt()
  .custom(async (id) => {
        const game = await Games.get_game(id);
        if (game.isErr() || game.value.isNone())
            return Promise.reject(`Game with ${id} does not exist`);
        return Promise.resolve();
  })
  .bail()
  .customSanitizer(async (id) => {
    return (await Games.get_game(id)).unwrap().unwrap();
  });

function string_validator(field: string, min: number, max: number) {
  return body(field)
    .isString()
    .trim()
    .notEmpty()
    .isLength({ min, max})
    .withMessage(`${field} must be between ${min} and ${max} characters`);
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

export const new_game_validator = game_validators().map(validator => validator.exists());
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
