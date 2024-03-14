import { body, query, param, validationResult } from 'express-validator';
import * as Games from './games.js';
import { Request, Response, NextFunction } from 'express';

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
  .custom(async (id) => {
        const game = await Games.get_game(id);
        if (game.isErr() || game.value.isNone())
            return Promise.reject(`Game with ${id} does not exist`);
        return Promise.resolve();
    });

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
