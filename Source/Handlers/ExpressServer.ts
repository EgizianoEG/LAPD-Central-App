import { connections as MongooseConnection } from "mongoose";
import { ShutdownStatus } from "./ProcessShutdownHandler.js";
import { Client, Status } from "discord.js";
import { rateLimit } from "express-rate-limit";
import {
  CollectHealthMetrics,
  GetDiscordAPILatency,
  GetDatabaseLatency,
  GetOSMetrics,
  AppResponse,
} from "#Utilities/Helpers/MetricsCollector.js";

import Express, { Request, Response, NextFunction } from "express";
import DurHumanizer from "humanize-duration";
import FileSystem from "node:fs";
import AppLogger from "#Utilities/Classes/AppLogger.js";
import TTLCache from "@isaacs/ttlcache";
import Path from "node:path";

// -------------------------------------------------------------------------------------------
// Express Server Handler:
// -----------------------
const AppServer = Object.seal({
  App: null as ReturnType<typeof Express> | null,
  Server: null as ReturnType<ReturnType<typeof Express>["listen"]> | null,
});

export const GetExpressServerApp = (): ReturnType<typeof Express> | null => {
  return AppServer.App;
};

export const GetExpressServerInstance = (): ReturnType<
  ReturnType<typeof Express>["listen"]
> | null => {
  return AppServer.Server;
};

export default function ExpressServerHandler(App: Client) {
  const EAppPort = process.env.PORT ?? 10_000;
  const FileLabel = "Handlers:ExpressServer";
  const ContentTypeHeader = "Content-Type";
  const ExpressApp = Express();
  AppServer.App = ExpressApp;

  const RateLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 60,
  });

  const NotFoundPage = FileSystem.readFileSync(
    Path.join(import.meta.dirname, "..", "Resources", "HTML", "404.html"),
    { encoding: "utf-8" }
  );

  ExpressApp.disable("x-powered-by");
  ExpressApp.use(RateLimiter);
  ExpressApp.use((_, Res, Next) => {
    if (ShutdownStatus.IsShuttingDown) {
      Res.setHeader("Connection", "close");
      Res.status(503).end("Server is in the process of shutting down.");
      return;
    }

    Next();
  });

  ExpressApp.use((_, Res: Response, Next: NextFunction) => {
    Res.setHeader(ContentTypeHeader, "application/json");
    Next();
  });

  ExpressApp.get("/", HandleRootRequest);
  ExpressApp.get("/metrics", (Req, Res) => HandleMetricsRequest(Req, Res, App));
  ExpressApp.get("/health", (Req, Res) => HandleHealthRequest(Req, Res, App));
  ExpressApp.get("/health/discord", (Req, Res) => HandleDiscordHealthRequest(Req, Res, App));
  ExpressApp.get("/health/database", HandleDatabaseHealthRequest);
  ExpressApp.get("/favicon.ico", (Req, Res) =>
    HandleFaviconRequest(Req, Res, FileLabel, ContentTypeHeader)
  );

  ExpressApp.use((Req, Res) => HandleNotFoundRequest(Req, Res, NotFoundPage, ContentTypeHeader));
  AppServer.Server = ExpressApp.listen(EAppPort, () => {
    AppLogger.info({
      message: "Express app listening on port %o.",
      label: FileLabel,
      splat: [EAppPort],
    });
  }).on("error", (Err) => {
    AppLogger.error({
      message: "Express server failed to start.",
      label: FileLabel,
      stack: Err.stack,
      error: Err,
    });
  });
}

// -------------------------------------------------------------------------------------------
// Route Handlers:
// ---------------
async function HandleMetricsRequest(_: Request, Res: Response, App: Client) {
  const HealthMetrics = await CollectHealthMetrics(App);
  const OSMetrics = await GetOSMetrics(true);

  Res.status(HealthMetrics.status === "healthy" ? 200 : 503).end(
    JSON.stringify(
      {
        status: HealthMetrics.status,
        timestamp: new Date().toISOString(),
        client: {
          ready: App.isReady(),
          ratelimited: AppResponse.ratelimited,
          uptime: DurHumanizer(App.uptime ?? 0, {
            conjunction: " and ",
            largest: 4,
            round: true,
          }),
          websocket: {
            latency: App.ws.ping,
            status: Status[App.ws.status],
          },
          discord_api: {
            latency: HealthMetrics.discord.latency,
            healthy: HealthMetrics.discord.healthy,
          },
        },
        database: HealthMetrics.database,
        host: OSMetrics,
      },
      null,
      2
    )
  );
}

function HandleHealthRequest(_: Request, Res: Response, App: Client) {
  const IsHealthy = CheckOverallHealth(App);

  if (IsHealthy) {
    Res.status(200).json({ status: "healthy" });
  } else {
    Res.status(503).json({
      status: "unhealthy",
      checks: {
        discord: App.isReady(),
        database: MongooseConnection[0].readyState === 1,
        ratelimited: AppResponse.ratelimited,
      },
    });
  }
}

async function HandleDiscordHealthRequest(_: Request, Res: Response, App: Client) {
  const Health = await CheckDiscordHealth(App);
  Res.status(Health.status_code).json({
    status: Health.status,
    checks: Health.checks,
  });
}

async function HandleDatabaseHealthRequest(_: Request, Res: Response) {
  const Health = await CheckDatabaseHealth();
  Res.status(Health.status_code).json({
    status: Health.status,
    checks: Health.checks,
  });
}

function HandleFaviconRequest(
  _: Request,
  Res: Response,
  FileLabel: string,
  ContentTypeHeader: string
) {
  const FaviconPath = Path.join(import.meta.dirname, "..", "Resources", "Imgs", "favicon.ico");

  if (!FileSystem.existsSync(FaviconPath)) {
    AppLogger.warn({
      message: "Favicon file not found at %s",
      label: FileLabel,
      splat: [FaviconPath],
    });

    Res.status(404).end();
    return;
  }

  Res.setHeader(ContentTypeHeader, "image/x-icon");
  Res.setHeader("Cache-Control", "public, max-age=86400");
  Res.sendFile(FaviconPath, (Err) => {
    if (Err) {
      AppLogger.warn({
        message: "Failed to send favicon file.",
        label: FileLabel,
        stack: Err.stack,
        error: Err,
      });
      Res.status(404).end();
    }
  });
}

function HandleRootRequest(_: Request, Res: Response) {
  Res.end(JSON.stringify({ message: "OK" }, null, 2));
}

function HandleNotFoundRequest(
  _: Request,
  Res: Response,
  NotFoundPage: string,
  ContentTypeHeader: string
) {
  Res.setHeader(ContentTypeHeader, "text/html");
  Res.end(NotFoundPage);
}

// -------------------------------------------------------------------------------------------
// Utility Functions:
// ------------------
const LatencyCache = {
  cache_key: "latency",
  discord: new TTLCache<string, number | null>({
    ttl: 3 * 1000,
    checkAgeOnGet: true,
  }),
  database: new TTLCache<string, number | null>({
    ttl: 3 * 1000,
    checkAgeOnGet: true,
  }),
};

async function GetCachedDiscordLatency(App: Client): Promise<number | null> {
  const Cached = LatencyCache.discord.get(LatencyCache.cache_key);
  if (Cached !== undefined) {
    return Cached;
  }

  const Latency = await GetDiscordAPILatency(App);
  LatencyCache.discord.set(LatencyCache.cache_key, Latency);
  return Latency;
}

async function GetCachedDatabaseLatency(): Promise<number | null> {
  const Cached = LatencyCache.database.get(LatencyCache.cache_key);
  if (Cached !== undefined) {
    return Cached;
  }

  const Latency = await GetDatabaseLatency();
  LatencyCache.database.set(LatencyCache.cache_key, Latency);
  return Latency;
}

function IsLatencyHealthy(Latency: number | null): boolean {
  return Latency !== null && Latency >= 0 && Latency < 2500;
}

async function CheckDiscordHealth(App: Client) {
  const APILatency = await GetCachedDiscordLatency(App);
  const IsLatencyHealthy_ = IsLatencyHealthy(APILatency);
  const IsHealthy = App.isReady() && !AppResponse.ratelimited && IsLatencyHealthy_;

  return {
    status: IsHealthy ? "healthy" : "unhealthy",
    status_code: IsHealthy ? 200 : 503,
    checks: {
      ready: App.isReady(),
      api: {
        latency: APILatency,
        ratelimited: AppResponse.ratelimited,
      },
      websocket: {
        latency: App.ws.ping,
        status: Status[App.ws.status],
      },
    },
  };
}

async function CheckDatabaseHealth() {
  const DatabaseLatency = await GetCachedDatabaseLatency();
  const IsLatencyHealthy_ = IsLatencyHealthy(DatabaseLatency);
  const IsConnected = MongooseConnection[0].readyState === 1;
  const IsHealthy = IsConnected && IsLatencyHealthy_;

  return {
    status: IsHealthy ? "healthy" : "unhealthy",
    status_code: IsHealthy ? 200 : 503,
    checks: {
      connected: IsConnected,
      latency: DatabaseLatency,
    },
  };
}

function CheckOverallHealth(App: Client): boolean {
  return (
    App.isReady() &&
    App.ws.status === Status.Ready &&
    MongooseConnection[0].readyState === 1 &&
    !AppResponse.ratelimited
  );
}
