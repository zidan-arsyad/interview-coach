// Runs after `npm install`: creates the private profile/ folder from profile.example/, and .env
// from .env.example, if they don't exist yet.
import { ensureEnvFile, ensureProfile } from "../server/profile.ts";

if (!ensureProfile()) console.log("profile/ already exists; leaving it as it is.");
ensureEnvFile();
