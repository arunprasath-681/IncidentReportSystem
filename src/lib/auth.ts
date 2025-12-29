import NextAuth from "next-auth";
import { type JWT } from "next-auth/jwt";
import Google from "next-auth/providers/google";
import { getUserRoleWithToken, type UserRole } from "./sheets/users";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email: string;
      name: string;
      image?: string;
      role: UserRole;
      campusCode?: string;
      isAuthorized: boolean;
      impersonating?: string;
    };
    accessToken?: string;
  }

  interface User {
    role?: UserRole;
    campusCode?: string;
    isAuthorized?: boolean;
    impersonating?: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role?: UserRole;
    campusCode?: string;
    accessToken?: string;
    refreshToken?: string;
    isAuthorized?: boolean;
    impersonating?: string;
  }
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: {
        params: {
          scope: "openid email profile https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive.file",
          access_type: "offline",
          prompt: "consent",
        },
      },
    }),
  ],
  callbacks: {
    async jwt({ token, account }) {
      if (account) {
        token.accessToken = account.access_token;
        token.refreshToken = account.refresh_token;
      }

      // Fetch user role from spreadsheet after login
      if (token.accessToken && token.email && token.role === undefined) {
        try {
          const roleInfo = await getUserRoleWithToken(token.accessToken as string, token.email as string);
          token.role = roleInfo.role;
          token.campusCode = roleInfo.campusCode;
          token.isAuthorized = roleInfo.isAuthorized;
        } catch (error) {
          console.error("Error fetching user role:", error);
          token.role = "not_authorized";
          token.isAuthorized = false;
        }
      }

      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.role = token.role as UserRole;
        session.user.campusCode = token.campusCode as string | undefined;
        session.user.isAuthorized = token.isAuthorized as boolean;
        session.user.impersonating = token.impersonating as string | undefined;
        session.accessToken = token.accessToken as string;
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  session: {
    strategy: "jwt",
  },
});
