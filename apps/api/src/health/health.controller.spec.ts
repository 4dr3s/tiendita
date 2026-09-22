import { HealthController, type HealthPayload } from "./health.controller.js";

describe("HealthController", () => {
  it("reports ok status with uptime and timestamp", () => {
    const controller = new HealthController();
    const body: HealthPayload = controller.check();

    expect(body.status).toBe("ok");
    expect(typeof body.uptime).toBe("number");
    expect(body.uptime).toBeGreaterThanOrEqual(0);
    expect(new Date(body.timestamp).getTime()).not.toBeNaN();
  });
});