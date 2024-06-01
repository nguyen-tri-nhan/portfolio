type EnvProps = {
    API_URL: string;
}

export const Env: EnvProps = {
    API_URL: import.meta.env.VITE_API_URL as string ?? ''
}
