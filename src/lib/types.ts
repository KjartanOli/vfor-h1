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
  handlers: Array<RequestHandler>
};

export interface Endpoint {
  href: string,
  methods: Array<MethodDescriptor>
}
