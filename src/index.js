import express from "express";
import { serve } from "inngest/express";
import { inngest, functions } from "./inngest/index.js";
import indexRoutes from "./routes/index.routes.js";

const app = express();

app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

app.use("/api/inngest", serve({ client: inngest, functions }));

app.get("/health", (req, res) => {
  res.json({ message: "Healthy" });
});

app.use("/api/index", indexRoutes);

app.listen(3000, () => {
  console.log("Server is running on port 3000");
});
