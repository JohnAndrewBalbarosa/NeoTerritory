/**
 * Authentication / authorization types shared across routes and middleware.
 */

import type { Request } from 'express';

export type Role = 'user' | 'admin';

export interface JwtPayload {
  userId: number;
  username: string;
  role: Role;
  iat: number;
  exp: number;
}

export interface AuthedRequest extends Request {
  user: JwtPayload;
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  user: {
    id: number;
    username: string;
    role: Role;
  };
}

export interface RegisterRequest {
  username: string;
  email: string;
  password: string;
}
