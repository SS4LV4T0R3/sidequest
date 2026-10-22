import path from 'node:path';
import dotenv from 'dotenv';
import { createRuntimeConfig } from './runtime';

const backendDirectory = path.resolve(__dirname, '../..');
dotenv.config({ path: path.join(backendDirectory, '.env') });

export const config = createRuntimeConfig(process.env, backendDirectory);
process.env.TZ = config.timezone;
