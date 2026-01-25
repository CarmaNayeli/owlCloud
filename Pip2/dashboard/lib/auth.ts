import { AuthOptions } from 'next-auth';
import DiscordProvider from 'next-auth/providers/discord';

// Check environment variables
const requiredEnvVars = {
  DISCORD_CLIENT_ID: process.env.DISCORD_CLIENT_ID,
  DISCORD_CLIENT_SECRET: process.env.DISCORD_CLIENT_SECRET,
  NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET,
  NEXTAUTH_URL: process.env.NEXTAUTH_URL,
  DISCORD_REDIRECT_URI: process.env.DISCORD_REDIRECT_URI,
  NEXTAUTH_URL_INTERNAL: process.env.NEXTAUTH_URL_INTERNAL
};

console.log('🔧 Environment Variables Check:', {
  DISCORD_CLIENT_ID: requiredEnvVars.DISCORD_CLIENT_ID ? 'set' : 'MISSING',
  DISCORD_CLIENT_SECRET: requiredEnvVars.DISCORD_CLIENT_SECRET ? 'set' : 'MISSING',
  NEXTAUTH_SECRET: requiredEnvVars.NEXTAUTH_SECRET ? 'set' : 'MISSING',
  NEXTAUTH_URL: requiredEnvVars.NEXTAUTH_URL || 'MISSING',
  DISCORD_REDIRECT_URI: requiredEnvVars.DISCORD_REDIRECT_URI || 'MISSING',
  NEXTAUTH_URL_INTERNAL: requiredEnvVars.NEXTAUTH_URL_INTERNAL || 'MISSING',
  NODE_ENV: process.env.NODE_ENV
});

// Check if Discord provider can be initialized
try {
  const discordProvider = DiscordProvider({
    clientId: process.env.DISCORD_CLIENT_ID!,
    clientSecret: process.env.DISCORD_CLIENT_SECRET!,
    authorization: {
      params: {
        scope: 'identify guilds',
      },
    },
  });
  console.log('✅ Discord provider initialized successfully');
} catch (error) {
  console.error('❌ Discord provider initialization failed:', error);
}

export const authOptions: AuthOptions = {
  providers: [
    DiscordProvider({
      clientId: process.env.DISCORD_CLIENT_ID!,
      clientSecret: process.env.DISCORD_CLIENT_SECRET!,
      authorization: {
        params: {
          scope: 'identify guilds',
        },
      },
    }),
  ],
  callbacks: {
    async signIn({ user, account, profile, email, credentials }) {
      console.log('🔑 Sign In Callback:', {
        hasUser: !!user,
        hasAccount: !!account,
        hasProfile: !!profile,
        provider: account?.provider,
        accountType: account?.type,
        hasCredentials: !!credentials
      });
      return true;
    },
    async jwt({ token, account, profile }) {
      console.log('🔐 JWT Callback:', {
        hasAccount: !!account,
        hasProfile: !!profile,
        hasAccessToken: !!account?.access_token,
        accessTokenLength: account?.access_token?.length || 0,
        discordId: profile?.id
      });
      
      if (account) {
        token.accessToken = account.access_token;
        token.discordId = profile?.id;
        console.log('✅ Token updated:', {
          accessTokenSet: !!token.accessToken,
          discordIdSet: !!token.discordId
        });
      }
      
      console.log('🔐 JWT Result:', {
        hasAccessToken: !!token.accessToken,
        hasDiscordId: !!token.discordId
      });
      
      return token;
    },
    async session({ session, token }) {
      console.log('👤 Session Callback:', {
        hasSession: !!session,
        hasToken: !!token,
        hasAccessToken: !!token.accessToken,
        accessTokenLength: token.accessToken?.length || 0,
        discordId: token.discordId
      });
      
      if (session.user) {
        (session.user as any).discordId = token.discordId;
        (session.user as any).accessToken = token.accessToken;
        console.log('✅ Session updated:', {
          accessTokenSet: !!(session.user as any).accessToken,
          discordIdSet: !!(session.user as any).discordId
        });
      }
      
      console.log('👤 Session Result:', {
        hasUser: !!session?.user,
        hasAccessToken: !!(session.user as any)?.accessToken,
        hasDiscordId: !!(session.user as any)?.discordId
      });
      
      return session;
    },
  },
  pages: {
    signIn: '/login',
  },
  debug: process.env.NODE_ENV === 'development',
};
