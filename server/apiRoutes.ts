import google from '../api/cxl/google';
import media from '../api/cxl/media';
import publicWork from '../api/cxl/public-work';
import publicWorks from '../api/cxl/public-works';
import share from '../api/cxl/share';
import collabProgress from '../api/cxl/collab-progress';
import authCallback from '../api/cxl/auth/callback';
import authLogin from '../api/cxl/auth/login';
import authLogout from '../api/cxl/auth/logout';
import authSession from '../api/cxl/auth/session';

export type NodeHandler = (req: any, res: any) => unknown; // eslint-disable-line @typescript-eslint/no-explicit-any

/** The /api/cxl/* handlers, shared by every host that is not Vercel (Render, Cloudflare). */
export const API_ROUTES: Record<string, NodeHandler> = {
  '/api/cxl/google': google,
  '/api/cxl/media': media,
  '/api/cxl/public-work': publicWork,
  '/api/cxl/public-works': publicWorks,
  '/api/cxl/share': share,
  '/api/cxl/collab-progress': collabProgress,
  '/api/cxl/auth/callback': authCallback,
  '/api/cxl/auth/login': authLogin,
  '/api/cxl/auth/logout': authLogout,
  '/api/cxl/auth/session': authSession
};
