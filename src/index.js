import express from "express";
import { serve } from "inngest/express";
import { inngest, functions } from "./inngest";

const app = express();

app.use(express.json());

app.use("/api/inngest", serve({ client: inngest, functions }));

app.get("/health", (req, res) => {
  res.json({ message: "Healthy" });
});

app.listen(3000, () => {
  console.log("Server is running on port 3000");
});
