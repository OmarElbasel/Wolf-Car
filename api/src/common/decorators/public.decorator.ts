import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'auth:public';

/** Skips authentication (login, refresh, public catalog, uploads, health). */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
