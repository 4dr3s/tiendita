import { Controller, Get } from "@nestjs/common";

export interface HealthPayload {
  status: "ok";
  uptime: number;
  timestamp: string;
}

@Controller("health")
export class HealthController {
  @Get()
  check(): HealthPayload {
    return {
      status: "ok",
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    };
  }
}