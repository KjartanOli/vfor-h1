import express, { Request, Response, NextFunction, RequestHandler } from 'express';
import jwt from 'jsonwebtoken';
import { Endpoint, Method, MethodDescriptor, ResourceType, User, default_method_descriptor } from '../lib/types.js';
import * as users from '../lib/users.js';
import * as Games from '../lib/games.js';
import { jwt_secret, token_lifetime } from '../app.js';
import passport from 'passport';
import { check_validation, existing_user_validator, game_id_validator, new_game_validator, new_user_validator, patch_game_validator, rating_validator } from '../lib/validators.js';
import { uploadImage } from '../lib/cloudinary.js';
import { logger } from '../lib/logger.js';
import { matchedData } from 'express-validator';
import { decodeHtmlEntities } from '../lib/utils.js';

export const router = express.Router();

const endpoints: Array<Endpoint> = [
  {
    href: '/', methods: [
      {
        ...default_method_descriptor,
        method: Method.GET,
        handlers: [get_index]
      }
    ]
  },
  {
    href: '/login',
    methods: [
      {
        ...default_method_descriptor,
        validation: [...existing_user_validator],
        method: Method.POST,
        handlers: [post_login]
      }
    ]
  },
  {
    href: '/register',
    methods: [
      {
        ...default_method_descriptor,
        method: Method.POST,
        validation: [...new_user_validator],
        handlers: [post_register, post_login]
      }
    ]
  },
  {
    href: '/games',
    methods: [
      {
        ...default_method_descriptor,
        method: Method.GET,
        handlers: [get_games]
      },
      {
        ...default_method_descriptor,
        method: Method.POST,
        authentication: [ensureAuthenticated, ensureAdmin],
        validation: [...new_game_validator],
        handlers: [post_game]
      }
    ]
  },
  {
    href: '/games/:id',
    methods: [
      {
        ...default_method_descriptor,
        method: Method.GET,
        validation: [game_id_validator],
        handlers: [get_game_by_id]
      },
      {
        ...default_method_descriptor,
        method: Method.DELETE,
        authentication: [ensureAuthenticated, ensureAdmin],
        validation: [game_id_validator],
        handlers: [delete_game_by_id]
      },
      {
        ...default_method_descriptor,
        method: Method.PATCH,
        authentication: [ensureAuthenticated, ensureAdmin],
        validation: [game_id_validator, ...patch_game_validator],
        handlers: [patch_game_by_id]
      }
    ]
  },
  {
    href: '/games/:id/ratings',
    methods: [
      {
        ...default_method_descriptor,
        method: Method.GET,
        validation: [game_id_validator],
        handlers: [get_game_ratings]
      },
      {
        ...default_method_descriptor,
        method: Method.POST,
        authentication: [ensureAuthenticated],
        validation: [game_id_validator, rating_validator],
        handlers: [post_game_ratings]
      },
      {
        ...default_method_descriptor,
        method: Method.PATCH,
        authentication: [ensureAuthenticated],
        validation: [game_id_validator, rating_validator],
        handlers: [patch_game_ratings]
      }
    ]
  }
]

async function ensureAuthenticated(req: Request, res: Response, next: NextFunction) {
  return passport.authenticate(
    'jwt',
    { session: false },
    // TODO: Find correct types for err and info
    (err: any, user: User, info: any) => {
      if (err)
        return next(err);
      if (!user) {
        const error = info.name === 'TokenExpiredError'
          ? 'expired token' : 'invalid token';
        return res.status(401).json({ error });
      }

      req.user = user;
      return next();
    })(req, res, next);
}

async function ensureAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.user?.admin)
    return res.status(401).json({ error: 'Insufficient permissions' });

  next();
}


async function get_index(req: Request, res: Response) {
  res.json(endpoints.map(endpoint => ({
    href: endpoint.href,
    methods: endpoint.methods.map(endpoint => Method[endpoint.method])
  })));
}

async function post_login(req: Request, res: Response) {
  if (req.resource?.type !== ResourceType.USER)
    return res.status(500).json({ error: 'Internal error' });

  const user = req.resource;
  const { password } = matchedData(req);

  if (!await users.compare_passwords(password, user))
    return res.status(401).json({ error: 'Incorrect username or password' });

  const data = { id: user.id };
  const options = { expiresIn: token_lifetime() };
  const token = jwt.sign({ data }, jwt_secret(), options);

  return res.json({ token });
}

async function post_register(req: Request, res: Response, next: NextFunction) {
  const { username, name, password } = matchedData(req);

  const result = await users.create({
    username, name, password
  });

  if (result.isErr())
    return res.status(500).json({ error: 'Internal error' });

  req.resource = result.value;
  req.resource.type = ResourceType.USER;
  return next();
}

async function get_games(req: Request, res: Response) {
  console.log(req.query.limit, typeof req.query.limit)
  const limit = (typeof req.query.limit === 'number')
    ? req.query.limit
    : ((req.query.limit && typeof req.query.limit === 'string')
      ? parseInt(req.query.limit, 10)
      : null);
  console.log(limit)
  const games = await Games.get_games(req.skip, limit || null);

  if (games.isErr()) {
    return res.status(500).json({ error: 'Could not get games' });
  }

  return res.json(games.value);
}

async function post_game(req: Request, res: Response) {
  const { name, category, description, studio, year, image } = matchedData(req);

  const game = await Games.insert_game({
    name,
    category,
    description,
    studio,
    year,
    image: decodeHtmlEntities(image)
  });

  if (game.isErr()) {
    return res.status(500).json({ error: 'Could not insert game' });
  }

  return res.json(game.value);
}

async function get_game_by_id(req: Request, res: Response) {
    if (req.resource?.type !== ResourceType.GAME)
        return res.status(500).json({ error: 'Internal error' });

    return res.json(req.resource);
}

async function delete_game_by_id(req: Request, res: Response) {
      if (req.resource?.type !== ResourceType.GAME)
        return res.status(500).json({ error: 'Internal error' });

  const result = await Games.delete_game(req.resource.id);

    if (result.isErr())
      return res.status(500).json({ error: 'Could not delete game' });
    return res.status(204).json();
}

async function patch_game_by_id(req: Request, res: Response) {
    if (req.resource?.type !== ResourceType.GAME)
        return res.status(500).json({ error: 'Internal error' });

    const { name, category, description, studio, year, image } = matchedData(req);
    const game = req.resource;

    const updated_game = await Games.update_game({
        id: game.id,
        name: name || game.name,
        category: category || game.category,
        description: description || game.description,
        studio: studio || game.studio,
        year: year || game.year,
        image: image || game.image
    });

    if (!updated_game) {
        return res.status(500).json({ error: 'Could not update game' });
    }

    return res.json(updated_game);
}

async function get_game_ratings(req: Request, res: Response) {
      if (req.resource?.type !== ResourceType.GAME)
        return res.status(500).json({ error: 'Internal error' });

    const game = req.resource;
    const ratings = await Games.get_ratings(game.id);

    if (ratings.isErr()) {
        return res.status(500).json({ error: 'Could not get ratings' });
    }

    return res.json(ratings.value);
}

async function post_game_ratings(req: Request, res: Response) {
    if (req.resource?.type !== ResourceType.GAME)
        return res.status(500).json({ error: 'Internal error' });

    const game = req.resource;
    const user = req.user;
    // This condition should newer be false because the authentication
    // handlers should prevent ever reaching this function if the user
    // is not authenticated but the compiler can't see that.
    if (!user)
        return res.status(401).json({ error: 'You must be logged in to perform this action' });

  // This should be checked in a validation midleware, but we're
  // already using req.resource for the game object so we can't.  This
  // is ugly but the changes to allow req.resource to contain multiple
  // values are big enought that it's not worth it at this time.
    const r = await Games.get_rating(user.id, game.id);
    if (r.isErr())
        return res.status(500).json({ error: 'Internal error' });

    if (r.value.isSome())
        return res.status(400).json({ error: 'You have already rated this game' });

    const { rating } = matchedData(req);

    const result = await Games.insert_rating(user.id, game.id, rating);

    if (result.isErr()) {
        return res.status(500).json({ error: 'Could not insert rating' });
    }

    return res.json(result.value);
}

async function patch_game_ratings(req: Request, res: Response) {
    if (req.resource?.type !== ResourceType.GAME)
        return res.status(500).json({ error: 'Internal error' });

    const game = req.resource;
    const user = req.user;
    // This condition should newer be false because the authentication
    // handlers should prevent ever reaching this function if the user
    // is not authenticated but the compiler can't see that.
    if (!user)
        return res.status(401).json({ error: 'You must be logged in to perform this action' });

  // This should be checked in a validation midleware, but we're
  // already using req.resource for the game object so we can't.  This
  // is ugly but the changes to allow req.resource to contain multiple
  // values are big enought that it's not worth it at this time.
    const r = await Games.get_rating(user.id, game.id);
    if (r.isErr())
        return res.status(500).json({ error: 'Internal error' });

    if (r.value.isNone())
        return res.status(400).json({ error: 'You have not rated this game' });

    const { rating } = matchedData(req);

    const result = await Games.update_rating(user.id, game.id, rating);

    if (result.isErr()) {
        return res.status(500).json({ error: 'Could not insert rating' });
    }

    return res.json(result.value);
}

endpoints.forEach(endpoint => {
  endpoint.methods.forEach(method => {
    const routing_function = ((method: MethodDescriptor) => {
      switch (method.method) {
        case Method.GET:
          return (href: string, ...handlers: Array<RequestHandler>) => router.get(href, handlers)
        case Method.POST:
          return (href: string, ...handlers: Array<RequestHandler>) => router.post(href, handlers)
        case Method.PATCH:
          return (href: string, ...handlers: Array<RequestHandler>) => router.patch(href, handlers)
        case Method.DELETE:
          return (href: string, ...handlers: Array<RequestHandler>) => router.delete(href, handlers)
      }
    })(method);
    routing_function(endpoint.href, ...[
            ...method.authentication,
            ...method.validation,
            check_validation,
            ...method.handlers
    ]);
  });
});

