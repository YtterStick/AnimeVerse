import dotenv from "dotenv";
import { z } from "zod";
import path from "path";

// Load environment variables from .env file
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

const envSchema = z.object({
  PORT: z.coerce.number().default(3001),
  SUPABASE_URL: z.string().url("SUPABASE_URL must be a valid URL"),
  SUPABASE_SERVICE_KEY: z.string().min(1, "SUPABASE_SERVICE_KEY is required"),
});

let validatedEnv: z.infer<typeof envSchema>;

try {
  validatedEnv = envSchema.parse(process.env);
} catch (error) {
  if (error instanceof z.ZodError) {
    const missing = error.errors.map((e) => `${e.path.join(".")}: ${e.message}`).join("\n");
    console.error("❌ Invalid environment variables:\n" + missing);
  } else {
    console.error("❌ Failed to parse environment variables:", error);
  }
  process.exit(1);
}

export const env = validatedEnv;
export default env;
