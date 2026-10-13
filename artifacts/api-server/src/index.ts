import Fastify from "fastify";
import cors from "@fastify/cors";
import dashboardRoutes from "./routes/dashboard";
import networkRoutes from "./routes/network";
import phishingRoutes from "./routes/phishing";
import antitheftRoutes from "./routes/antitheft";
import settingsRoutes from "./routes/settings";

const app = Fastify({ logger: true });

app.register(cors, { origin: true });

app.register(dashboardRoutes);
app.register(networkRoutes);
app.register(phishingRoutes);
app.register(antitheftRoutes);
app.register(settingsRoutes);

app.get("/health", async () => {
  return { status: "ok" };
});

const port = Number(process.env.PORT ?? 3000);

app.listen({ port, host: "0.0.0.0" }).then(() => {
  console.log(`API listening on http://localhost:${port}`);
});

