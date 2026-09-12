import express from "express";
import cors from "cors";
import { toNodeHandler } from "better-auth/node";
import { serve } from "inngest/express";
import { inngest, functions } from "./inngest/index.js";
import { auth } from "./lib/auth.js";
import indexRoutes from "./routes/index.routes.js";
import chatRoutes from "./routes/chat.routes.js";
import reposRoutes from "./routes/repos.routes.js";

const app = express();

const allowedOrigins = (
  process.env.CORS_ORIGIN || "http://localhost:5173,http://localhost:3000,https://grepr.shreyxsh.me,https://grepr.vercel.app"
)
  .split(",")
  .map((origin) => origin.trim());

app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
  }),
);

// Better Auth needs the raw request body itself — must be mounted before express.json().
app.all("/api/auth/*splat", toNodeHandler(auth));

app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

app.use("/api/inngest", serve({ client: inngest, functions }));

app.get("/health", (req, res) => {
  res.json({ message: "Healthy" });
});

app.use("/api/index", indexRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/repos", reposRoutes);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
