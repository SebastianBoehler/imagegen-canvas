import Google from "next-auth/providers/google";
// https://authjs.dev/getting-started/migrating-to-v5

// Yes. Google’s gcloud CLI includes commands to create and manage OAuth client credentials—for example, gcloud alpha iam oauth-
// clients create (for centralized IAM-managed clients) and the older gcloud iam credentials oauth2client or Service Management
// variants. Availability may depend on project permissions, API enablement, and the exact SDK components installed, but the CLI
// itself does support generating OAuth client IDs/secrets and related credentials.

const config = {
  providers: [
    Google({
      clientId: process.env.AUTH_GOOGLE_ID!,
      clientSecret: process.env.AUTH_GOOGLE_SECRET!,
    }),
  ],
  secret: process.env.NEXTAUTH_SECRET,
  useSecureCookies: process.env.VERCEL === "1", // only true in production
  session: {
    maxAge: 60 * 60 * 24 * 30, // 30d
  },
  callbacks: {
    // signIn: async () => {
    //   return true;
    // },
    // session: async ({ session }) => {
    //   //TOOD: db user verification
    //   return session;
    // },
  },
  pages: {
    signIn: "/login",
    signOut: "/logout",
  },
};

export default config;
