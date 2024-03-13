import { Request, Response, NextFunction } from 'express';

export enum Method {
  GET,
  POST,
  PATCH,
  DELETE
}

export type Middleware = (req: Request, res: Response, next: NextFunction) => void;
export type Handler = (req: Request, res: Response) => void;

export type RequestHandler = Handler | Middleware;

export interface MethodDescriptor {
  method: Method,
  authentication: Array<Middleware>,
  validation: Array<Middleware>,
  handlers: Array<RequestHandler>
};

/**
 * A default method descriptor to reduce boilerplate.  If your method
 *  descriptor does not require authentication or validatian you can
 *  spread this value in its initialiser, i.e.
 * { ...default_method_descriptor } to set the authentication and
 * validation handlers as empty.
 */
export const default_method_descriptor = {
  authentication: [],
  validation: [],
};

export interface Endpoint {
  href: string,
  methods: Array<MethodDescriptor>
}

export interface User {
  id: number,
  username: string,
  name: string
  password: string,
  admin: boolean
}

export interface Game {
  id: number,
  name: string,
  category: string,
  description: string,
  studio: string,
  year: number
}

declare global {
  namespace Express {
    interface User {
      id: number,
      username: string,
      name: string
      password: string,
      admin: boolean
    }
  }
}
