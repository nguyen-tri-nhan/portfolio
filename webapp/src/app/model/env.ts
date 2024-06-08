type EnvProps = {
  API_URL: string;
};

export const Env: EnvProps = {
  API_URL: (import.meta.env.VITE_API_URL as string) ?? "",
};

type ProfileEnvProps = {
  Facebook: string;
  GitHub: string;
  LinkedIn: string;
};

export const ProfileEnv: ProfileEnvProps = {
  Facebook: (import.meta.env.VITE_FACEBOOK_URL as string) ?? "",
  GitHub: (import.meta.env.VITE_GITHUB_URL as string) ?? "",
  LinkedIn: (import.meta.env.VITE_LINKEDIN_URL as string) ?? "",
};
