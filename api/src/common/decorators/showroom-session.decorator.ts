import { SetMetadata } from '@nestjs/common';

export const SHOWROOM_SESSION_KEY = 'auth:showroom';

/**
 * Marks a route as served to the showroom kiosk. It then accepts only
 * SHOWROOM-audience access tokens; every other route rejects them.
 */
export const ShowroomSession = () => SetMetadata(SHOWROOM_SESSION_KEY, true);
