import { Env } from "../model/env";

const BASE_URL = Env.API_URL;

const API_V1 = `${BASE_URL}/api/v1`;

export const GITHUB = `${API_V1}/github/:category`;

export const GITHUB_FILE = `${API_V1}/github/:category/content`;
