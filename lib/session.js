import { sessionOptions } from 'iron-session/next';

export const ironOptions = {
  cookieName: "kds-pro-session",
  password: process.env.SECRET_COOKIE_PASSWORD, // Must be at least 32 characters long
  cookieOptions: {
    secure: process.env.NODE_ENV === "production",
    httpOnly: true, // Prevents client-side JS from accessing the cookie
  },
};
